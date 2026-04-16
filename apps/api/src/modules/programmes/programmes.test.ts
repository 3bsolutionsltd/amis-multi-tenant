import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TENANT = "ab000000-0000-0000-0000-000000000001";

const PROG = {
  id: "ab000000-0000-0000-0000-000000000010",
  code: "NCBC",
  title: "National Certificate in Business Computing",
  department: "ICT",
  duration_months: 12,
  level: "Certificate",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("GET /programmes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/programmes" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns programme list from the DB", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [PROG] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/programmes",
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([PROG]);
    expect(mockWithTenant).toHaveBeenCalledWith(TENANT, expect.any(Function));
  });

  it("returns 403 for a role without access", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/programmes",
      headers: { "x-tenant-id": TENANT, "x-dev-role": "student" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /programmes/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when programme not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/programmes/${PROG.id}`,
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns a programme by id", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [PROG] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/programmes/${PROG.id}`,
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(PROG);
  });
});

describe("POST /programmes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a programme and returns 201", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [PROG] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/programmes",
      headers: { "x-tenant-id": TENANT, "x-dev-role": "registrar", "content-type": "application/json" },
      payload: { code: "NCBC", title: "National Certificate in Business Computing", department: "ICT" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(PROG);
  });

  it("returns 422 on missing required fields", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/programmes",
      headers: { "x-tenant-id": TENANT, "x-dev-role": "registrar", "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 403 for non-write roles (hod)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/programmes",
      headers: { "x-tenant-id": TENANT, "x-dev-role": "hod", "content-type": "application/json" },
      payload: { code: "NCBC", title: "Test" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /programmes/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates a programme and returns it", async () => {
    const updated = { ...PROG, title: "Updated Title" };
    mockWithTenant.mockResolvedValueOnce({ rows: [updated] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/programmes/${PROG.id}`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "admin", "content-type": "application/json" },
      payload: { title: "Updated Title" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Updated Title");
  });

  it("returns 404 when programme not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/programmes/${PROG.id}`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "admin", "content-type": "application/json" },
      payload: { title: "X" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /programmes/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("soft-deletes a programme and returns 204", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ id: PROG.id }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/programmes/${PROG.id}`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when programme not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/programmes/${PROG.id}`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for non-write roles", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/programmes/${PROG.id}`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "instructor" },
    });
    expect(res.statusCode).toBe(403);
  });
});
