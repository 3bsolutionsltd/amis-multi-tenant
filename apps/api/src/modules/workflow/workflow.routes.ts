import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import type { WorkflowDefinition } from "../config/config.schema.js";

// ------------------------------------------------------------------ types

interface WorkflowInstance {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  workflow_key: string;
  current_state: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  workflow_key: string;
  from_state: string | null;
  to_state: string;
  action_key: string;
  actor_user_id: string | null;
  meta: unknown;
  created_at: string;
}

// ------------------------------------------------------------------ helpers

function tenantHeader(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const h = req.headers["x-tenant-id"];
  return typeof h === "string" && h.length > 0 ? h : null;
}

/**
 * Load the published config for a tenant and extract the named workflow.
 * Returns null if no published config or the workflow key doesn't exist.
 */
async function loadWorkflowDef(
  tid: string,
  key: string,
  client: import("pg").PoolClient,
): Promise<WorkflowDefinition | null> {
  const { rows } = await client.query<{
    payload: { workflows?: Record<string, WorkflowDefinition> };
  }>(
    `SELECT payload FROM platform.config_versions
     WHERE tenant_id = $1 AND status = 'published'
     LIMIT 1`,
    [tid],
  );
  const config = rows[0];
  if (!config) return null;
  return config.payload?.workflows?.[key] ?? null;
}

// ------------------------------------------------------------------ routes

export async function workflowRoutes(app: FastifyInstance) {
  // ---------- POST /workflow/:entityType/:entityId/init
  // Creates a workflow instance and writes the first (init) event.
  app.post<{
    Params: { entityType: string; entityId: string };
    Body: { workflowKey: string; initialState?: string };
  }>("/workflow/:entityType/:entityId/init", async (req, reply) => {
    const tid = tenantHeader(req);
    if (!tid)
      return reply.status(400).send({ error: "x-tenant-id header required" });

    const { entityType, entityId } = req.params;
    const { workflowKey, initialState } = req.body ?? {};
    const actorUserId = req.user?.userId ?? null;

    if (!workflowKey) {
      return reply.status(400).send({ error: "body.workflowKey is required" });
    }

    const result = await withTenant(tid, async (client) => {
      // Load the workflow definition from the published config
      const wf = await loadWorkflowDef(tid, workflowKey, client);
      if (!wf) {
        return {
          configError: true,
          message: `workflow "${workflowKey}" not found in published config`,
        } as const;
      }

      const startState = initialState ?? wf.initial_state;
      if (!wf.states.includes(startState)) {
        return {
          configError: true,
          message: `initialState "${startState}" is not a valid state`,
        } as const;
      }

      // Fail if an instance already exists
      const { rows: existing } = await client.query<{ id: string }>(
        `SELECT id FROM app.workflow_instances
         WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
        [tid, entityType, entityId],
      );
      if (existing[0]) {
        return { alreadyExists: true } as const;
      }

      // Create the instance
      const { rows: instRows } = await client.query<WorkflowInstance>(
        `INSERT INTO app.workflow_instances
           (tenant_id, entity_type, entity_id, workflow_key, current_state)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [tid, entityType, entityId, workflowKey, startState],
      );
      const instance = instRows[0];

      // Write the init event
      const { rows: evtRows } = await client.query<WorkflowEvent>(
        `INSERT INTO app.workflow_events
           (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id)
         VALUES ($1, $2, $3, $4, NULL, $5, '__init__', $6)
         RETURNING *`,
        [tid, entityType, entityId, workflowKey, startState, actorUserId],
      );

      return { instance, event: evtRows[0] };
    });

    if ("configError" in result)
      return reply.status(422).send({ error: result.message });
    if ("alreadyExists" in result)
      return reply
        .status(409)
        .send({ error: "workflow instance already exists for this entity" });
    return reply.status(201).send(result);
  });

  // ---------- POST /workflow/:entityType/:entityId/transition
  // Validates and fires a transition, updating current_state and appending an event.
  app.post<{
    Params: { entityType: string; entityId: string };
    Body: {
      workflowKey: string;
      action: string;
      meta?: Record<string, unknown>;
    };
  }>("/workflow/:entityType/:entityId/transition", async (req, reply) => {
    const tid = tenantHeader(req);
    if (!tid)
      return reply.status(400).send({ error: "x-tenant-id header required" });

    const { entityType, entityId } = req.params;
    const { workflowKey, action, meta } = req.body ?? {};
    const actorUserId = req.user?.userId ?? null;

    if (!workflowKey || !action) {
      return reply
        .status(400)
        .send({ error: "body.workflowKey and body.action are required" });
    }

    const result = await withTenant(tid, async (client) => {
      // Load the workflow definition from the published config
      const wf = await loadWorkflowDef(tid, workflowKey, client);
      if (!wf) {
        return {
          configError: true,
          message: `workflow "${workflowKey}" not found in published config`,
        } as const;
      }

      // Load the current instance
      const { rows: instRows } = await client.query<WorkflowInstance>(
        `SELECT * FROM app.workflow_instances
         WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
        [tid, entityType, entityId],
      );
      const instance = instRows[0] ?? null;
      if (!instance) return { notFound: true } as const;

      // Verify the workflowKey matches the instance
      if (instance.workflow_key !== workflowKey) {
        return {
          wrongKey: true,
          message: `instance workflow_key is "${instance.workflow_key}", not "${workflowKey}"`,
        } as const;
      }

      // Find a valid transition from the current state
      const transition = wf.transitions.find(
        (t) => t.action === action && t.from === instance.current_state,
      );
      if (!transition) {
        return {
          invalidTransition: true,
          message: `action "${action}" is not valid from state "${instance.current_state}"`,
        } as const;
      }

      // Update instance state
      const { rows: updated } = await client.query<WorkflowInstance>(
        `UPDATE app.workflow_instances
         SET current_state = $1, updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [transition.to, instance.id],
      );

      // Append the event
      const { rows: evtRows } = await client.query<WorkflowEvent>(
        `INSERT INTO app.workflow_events
           (tenant_id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          tid,
          entityType,
          entityId,
          workflowKey,
          instance.current_state,
          transition.to,
          action,
          actorUserId,
          JSON.stringify(meta ?? {}),
        ],
      );

      return { instance: updated[0], event: evtRows[0] };
    });

    if ("configError" in result)
      return reply.status(422).send({ error: result.message });
    if ("notFound" in result)
      return reply
        .status(404)
        .send({ error: "workflow instance not found — call /init first" });
    if ("wrongKey" in result)
      return reply.status(400).send({ error: result.message });
    if ("invalidTransition" in result)
      return reply.status(400).send({ error: result.message });
    return reply.status(200).send(result);
  });

  // ---------- GET /workflow/:entityType/:entityId
  // Returns the current workflow state for an entity (404 if no instance).
  app.get<{
    Params: { entityType: string; entityId: string };
  }>("/workflow/:entityType/:entityId", async (req, reply) => {
    const tid = tenantHeader(req);
    if (!tid)
      return reply.status(400).send({ error: "x-tenant-id header required" });

    const { entityType, entityId } = req.params;

    const instance = await withTenant(tid, async (client) => {
      const { rows } = await client.query<WorkflowInstance>(
        `SELECT * FROM app.workflow_instances
         WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
        [tid, entityType, entityId],
      );
      return rows[0] ?? null;
    });

    if (!instance)
      return reply.status(404).send({ error: "workflow instance not found" });

    return reply.status(200).send({
      workflowKey: instance.workflow_key,
      currentState: instance.current_state,
    });
  });

  // ---------- GET /workflows/:workflowKey
  // Returns the workflow definition from the tenant's published config.
  app.get<{
    Params: { workflowKey: string };
  }>("/workflows/:workflowKey", async (req, reply) => {
    const tid = tenantHeader(req);
    if (!tid)
      return reply.status(400).send({ error: "x-tenant-id header required" });

    const { workflowKey } = req.params;

    const definition = await withTenant(tid, async (client) => {
      return loadWorkflowDef(tid, workflowKey, client);
    });

    if (!definition)
      return reply
        .status(404)
        .send({
          error: `workflow "${workflowKey}" not found in published config`,
        });

    return reply.status(200).send(definition);
  });

  // ---------- GET /workflow/:entityType/:entityId/history
  // Returns all events for this entity, ordered oldest-first.
  app.get<{
    Params: { entityType: string; entityId: string };
    Querystring: { workflowKey?: string };
  }>("/workflow/:entityType/:entityId/history", async (req, reply) => {
    const tid = tenantHeader(req);
    if (!tid)
      return reply.status(400).send({ error: "x-tenant-id header required" });

    const { entityType, entityId } = req.params;
    const { workflowKey } = req.query;

    const rows = await withTenant(tid, async (client) => {
      if (workflowKey) {
        const { rows } = await client.query<WorkflowEvent>(
          `SELECT id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id, meta, created_at
           FROM app.workflow_events
           WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND workflow_key = $4
           ORDER BY created_at ASC`,
          [tid, entityType, entityId, workflowKey],
        );
        return rows;
      }
      const { rows } = await client.query<WorkflowEvent>(
        `SELECT id, entity_type, entity_id, workflow_key, from_state, to_state, action_key, actor_user_id, meta, created_at
         FROM app.workflow_events
         WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
         ORDER BY created_at ASC`,
        [tid, entityType, entityId],
      );
      return rows;
    });

    return reply.status(200).send(rows);
  });
}
