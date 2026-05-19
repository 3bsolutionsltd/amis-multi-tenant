import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { superPool } from "../../db/pool.js";
import { getOutboxQueue } from "../../lib/queue.js";
import { getTenantId } from "../../lib/tenantId.js";

// ------------------------------------------------------------------ constants

const MAX_EVENTS_PER_FLUSH = 500;

// Allowed student fields that clients may update via sync
const ALLOWED_STUDENT_FIELDS = new Set([
  "first_name",
  "last_name",
  "other_names",
  "date_of_birth",
  "gender",
  "phone",
  "email",
  "guardian_name",
  "guardian_phone",
  "guardian_email",
  "year_of_study",
]);

// ------------------------------------------------------------------ schema

const SyncEventSchema = z.object({
  eventId: z.string().uuid(),
  entityType: z.enum(["marks", "students", "config"]),
  entityId: z.string().uuid(),
  operation: z.enum(["insert", "update", "delete"]),
  payload: z.record(z.unknown()),
  clientTimestamp: z.string().datetime(),
});

const FlushBodySchema = z.object({
  events: z
    .array(SyncEventSchema)
    .min(1, "at least one event required")
    .max(MAX_EVENTS_PER_FLUSH, `max ${MAX_EVENTS_PER_FLUSH} events per flush`),
});

type SyncEvent = z.infer<typeof SyncEventSchema>;

interface ConflictResult {
  eventId: string;
  reason: string;
  serverValue: unknown;
}

// ------------------------------------------------------------------ conflict processor

type ProcessResult =
  | { applied: true }
  | { skipped: true }
  | { conflict: true; reason: string; serverValue: unknown };

async function processEvent(
  client: PoolClient,
  tenantId: string,
  event: SyncEvent,
): Promise<ProcessResult> {
  // Config is always a conflict — follows draft→publish workflow
  if (event.entityType === "config") {
    return {
      conflict: true,
      reason: "config_immutable",
      serverValue: null,
    };
  }

  const clientTs = new Date(event.clientTimestamp);

  // ---- marks: reject if server version is newer
  if (event.entityType === "marks") {
    const { submission_id, student_id, score } = event.payload as {
      submission_id?: string;
      student_id?: string;
      score?: number;
    };

    if (!submission_id || !student_id || score === undefined) {
      return {
        conflict: true,
        reason: "invalid_marks_payload",
        serverValue: null,
      };
    }

    const { rows } = await client.query<{ updated_at: Date; score: string }>(
      `SELECT updated_at, score FROM app.mark_entries
       WHERE submission_id = $1 AND student_id = $2`,
      [submission_id, student_id],
    );

    if (rows[0] && rows[0].updated_at > clientTs) {
      return {
        conflict: true,
        reason: "server_version_newer",
        serverValue: {
          updated_at: rows[0].updated_at,
          score: Number(rows[0].score),
        },
      };
    }

    await client.query(
      `INSERT INTO app.mark_entries
         (tenant_id, submission_id, student_id, score, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (submission_id, student_id)
       DO UPDATE SET score = EXCLUDED.score, updated_at = EXCLUDED.updated_at`,
      [tenantId, submission_id, student_id, score, clientTs],
    );

    return { applied: true };
  }

  // ---- students: last-write-wins using clientTimestamp
  if (event.entityType === "students") {
    if (event.operation === "delete") {
      return { conflict: true, reason: "delete_not_supported", serverValue: null };
    }

    const { rows } = await client.query<{ updated_at: Date }>(
      `SELECT updated_at FROM app.students WHERE id = $1`,
      [event.entityId],
    );

    // LWW: if server is newer, skip silently
    if (rows[0] && rows[0].updated_at > clientTs) {
      return { skipped: true };
    }

    // Build SET clause from whitelisted payload fields
    const setClauses: string[] = [];
    const values: unknown[] = [event.entityId, tenantId];
    let idx = 3;

    for (const [key, val] of Object.entries(event.payload)) {
      if (ALLOWED_STUDENT_FIELDS.has(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (setClauses.length === 0) {
      return { skipped: true };
    }

    setClauses.push(`updated_at = $${idx}`);
    values.push(clientTs);

    await client.query(
      `UPDATE app.students SET ${setClauses.join(", ")} WHERE id = $1 AND tenant_id = $2`,
      values,
    );

    return { applied: true };
  }

  return { conflict: true, reason: "unsupported_entity_type", serverValue: null };
}

// ------------------------------------------------------------------ routes

export async function syncRoutes(app: FastifyInstance) {
  /**
   * GET /sync/status
   * Returns outbox queue depth (unprocessed event count) and the
   * timestamp of the last processed event.
   * Requires admin role.
   */
  app.get("/sync/status", async (req, reply) => {
    const user = (req as unknown as { user?: { role?: string } }).user;
    if (!user) {
      return reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Authentication required" });
    }
    if (user.role !== "admin" && user.role !== "platform_admin") {
      return reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Admin access required" });
    }

    const queueDepthResult = await superPool.query<{ depth: string }>(
      `SELECT COUNT(*) AS depth
         FROM platform.outbox_events
        WHERE processed_at IS NULL`
    );

    const lastProcessedResult = await superPool.query<{ last_processed: string | null }>(
      `SELECT MAX(processed_at) AS last_processed
         FROM platform.outbox_events`
    );

    const queue = getOutboxQueue();
    const redisConnected = queue !== null;

    return reply.status(200).send({
      queueDepth: parseInt(queueDepthResult.rows[0].depth, 10),
      lastProcessedAt: lastProcessedResult.rows[0].last_processed ?? null,
      workerActive: redisConnected,
    });
  });

  /**
   * POST /sync/flush
   *
   * Accepts a batch of offline events from a client outbox and applies them
   * with idempotency guarantees. Any authenticated tenant user may call this.
   */
  app.post("/sync/flush", async (req, reply) => {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return reply.status(400).send({ error: "x-tenant-id header required" });
    }

    const parsed = FlushBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: parsed.error.flatten() });
    }

    const { events } = parsed.data;

    let appliedCount = 0;
    let skippedCount = 0;
    const conflicts: ConflictResult[] = [];

    const client = await superPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ]);

      // Batch idempotency check — find which eventIds are already received
      const eventIds = events.map((e) => e.eventId);
      const { rows: alreadyStored } = await client.query<{ event_id: string }>(
        `SELECT event_id FROM platform.sync_received_events
         WHERE event_id = ANY($1::uuid[])`,
        [eventIds],
      );
      const alreadyReceived = new Set(alreadyStored.map((r) => r.event_id));

      for (const event of events) {
        // Already processed in a prior call — skip (idempotent)
        if (alreadyReceived.has(event.eventId)) {
          skippedCount++;
          continue;
        }

        const result = await processEvent(client, tenantId, event);

        if ("conflict" in result) {
          conflicts.push({
            eventId: event.eventId,
            reason: result.reason,
            serverValue: result.serverValue,
          });
        } else if ("skipped" in result) {
          skippedCount++;
        } else {
          appliedCount++;
        }

        // Record event so future calls skip it (even conflicts and LWW-skips)
        await client.query(
          `INSERT INTO platform.sync_received_events
             (event_id, tenant_id, entity_type, entity_id, operation, payload, client_timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (event_id) DO NOTHING`,
          [
            event.eventId,
            tenantId,
            event.entityType,
            event.entityId,
            event.operation,
            JSON.stringify(event.payload),
            event.clientTimestamp,
          ],
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return reply.status(200).send({
      applied: appliedCount,
      skipped: skippedCount,
      conflicts,
    });
  });
}
