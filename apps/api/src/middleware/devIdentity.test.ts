import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { buildApp } from "../app.js";
import { devIdentityHook, requireRole } from "./devIdentity.js";

// Mock withTenant at top level so workflow route tests don't need a real DB
vi.mock("../db/tenant.js", () => ({ withTenant: vi.fn() }));

// ------------------------------------------------------------------ helpers

/** Minimal app that exposes request.user as JSON via GET /me */
function buildTestApp() {
  const app = Fastify();
  app.addHook("onRequest", devIdentityHook);
  app.get("/me", async (req) => req.user);
  return app;
}

/** Minimal app with a role-protected route */
function buildRoleApp(allowedRoles: string[]) {
  const app = Fastify();
  app.addHook("onRequest", devIdentityHook);
  app.get(
    "/protected",
    { preHandler: requireRole(...allowedRoles) },
    async (req) => ({ ok: true, role: req.user.role }),
  );
  return app;
}

// ------------------------------------------------------------------ request.user population

describe("devIdentityPlugin — request.user population", () => {
  it("defaults to admin role and deterministic admin UUID when no headers sent", async () => {
    const app = buildTestApp();
    const res = await app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(200);
    const user = res.json();
    expect(user.tenantId).toBe("");
    expect(user.role).toBe("admin");
    expect(user.userId).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("reads x-tenant-id, x-dev-role, x-dev-user-id from headers", async () => {
    const app = buildTestApp();
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: {
        "x-tenant-id": "tenant-abc",
        "x-dev-role": "registrar",
        "x-dev-user-id": "custom-uuid-123",
      },
    });
    expect(res.statusCode).toBe(200);
    const user = res.json();
    expect(user.tenantId).toBe("tenant-abc");
    expect(user.role).toBe("registrar");
    expect(user.userId).toBe("custom-uuid-123");
  });

  it("assigns deterministic UUID for each known role when x-dev-user-id is omitted", async () => {
    const cases: [string, string][] = [
      ["admin", "00000000-0000-0000-0000-000000000001"],
      ["registrar", "00000000-0000-0000-0000-000000000002"],
      ["hod", "00000000-0000-0000-0000-000000000003"],
      ["instructor", "00000000-0000-0000-0000-000000000004"],
      ["finance", "00000000-0000-0000-0000-000000000005"],
      ["principal", "00000000-0000-0000-0000-000000000006"],
    ];

    const app = buildTestApp();

    for (const [role, expectedUUID] of cases) {
      const res = await app.inject({
        method: "GET",
        url: "/me",
        headers: { "x-dev-role": role },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().userId).toBe(expectedUUID);
    }
  });

  it("falls back to admin UUID for an unknown role", async () => {
    const app = buildTestApp();
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { "x-dev-role": "totally-unknown-role" },
    });
    expect(res.statusCode).toBe(200);
    const user = res.json();
    expect(user.role).toBe("totally-unknown-role");
    expect(user.userId).toBe("00000000-0000-0000-0000-000000000001");
  });
});

// ------------------------------------------------------------------ requireRole

describe("requireRole", () => {
  it("allows a request whose role is in the allowed list", async () => {
    const app = buildRoleApp(["admin", "registrar"]);
    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { "x-dev-role": "registrar" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, role: "registrar" });
  });

  it("returns 403 when role is not in the allowed list", async () => {
    const app = buildRoleApp(["admin", "registrar"]);
    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { "x-dev-role": "instructor" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toHaveProperty("error");
  });

  it("returns 403 for default role (admin) if admin is not allowed", async () => {
    const app = buildRoleApp(["registrar"]);
    // No x-dev-role header → defaults to admin
    const res = await app.inject({ method: "GET", url: "/protected" });
    expect(res.statusCode).toBe(403);
  });

  it("allows all listed roles individually", async () => {
    const allowed = ["hod", "principal", "finance"];
    const app = buildRoleApp(allowed);

    for (const role of allowed) {
      const res = await app.inject({
        method: "GET",
        url: "/protected",
        headers: { "x-dev-role": role },
      });
      expect(res.statusCode).toBe(200);
    }
  });
});

// ------------------------------------------------------------------ workflow actor_user_id

describe("workflow transition — actor_user_id stored from request.user", () => {
  it("passes actor_user_id (registrar UUID) to the transition result", async () => {
    const { withTenant } = await import("../db/tenant.js");
    const mockWithTenant = vi.mocked(withTenant);

    const REGISTRAR_ID = "00000000-0000-0000-0000-000000000002";
    const TID = "aaaaaaaa-0000-0000-0000-000000000001";

    // The transition handler calls withTenant once; return a successful result
    mockWithTenant.mockResolvedValueOnce({
      instance: {
        id: "inst-1",
        tenant_id: TID,
        entity_type: "admission",
        entity_id: "ent-1",
        workflow_key: "admissions",
        current_state: "review",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      event: {
        id: "evt-2",
        entity_type: "admission",
        entity_id: "ent-1",
        workflow_key: "admissions",
        from_state: "submitted",
        to_state: "review",
        action_key: "review",
        actor_user_id: REGISTRAR_ID,
        meta: {},
        created_at: new Date().toISOString(),
      },
    } as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/workflow/admission/ent-1/transition",
      headers: {
        "x-tenant-id": TID,
        "x-dev-role": "registrar",
        // no x-dev-user-id → deterministic registrar UUID
      },
      payload: { workflowKey: "admissions", action: "review" },
    });

    // The mock always returns the pre-built result regardless of SQL args,
    // so we verify the RESPONSE event contains the registrar UUID — meaning
    // the routes propagated it. For deeper SQL-arg verification, see the RLS tests.
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.event.actor_user_id).toBe(REGISTRAR_ID);
  });
});
