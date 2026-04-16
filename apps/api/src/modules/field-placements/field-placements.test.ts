import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "dd000000-0000-0000-0000-000000000001";
const adminH = { "x-tenant-id": TID, "x-dev-role": "admin" };
const registrarH = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const instructorH = { "x-tenant-id": TID, "x-dev-role": "instructor" };
const financeH = { "x-tenant-id": TID, "x-dev-role": "finance" };

const STUDENT_ID = "dd000000-0000-0000-0000-000000000010";

const PLACEMENT = {
  id: "dd000000-0000-0000-0000-000000000020",
  tenant_id: TID,
  student_id: STUDENT_ID,
  host_organisation: "Regional Hospital",
  supervisor: "Dr. Smith",
  placement_type: "clinical",
  start_date: "2026-02-01",
  end_date: "2026-05-31",
  status: "active",
  notes: null,
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  first_name: "Brian",
  last_name: "Dlamini",
};

const validBody = {
  student_id: STUDENT_ID,
  host_organisation: "Regional Hospital",
};

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ GET /field-placements

describe("GET /field-placements", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/field-placements" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns list from DB", async () => {
    mockWithTenant.mockResolvedValueOnce([PLACEMENT] as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/field-placements",
      headers: adminH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([PLACEMENT]);
  });

  it("returns 403 for finance role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/field-placements",
      headers: financeH,
    });
    expect(res.statusCode).toBe(403);
  });

  it("supports placement_type filter", async () => {
    mockWithTenant.mockResolvedValueOnce([] as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/field-placements?placement_type=clinical",
      headers: registrarH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("supports status filter", async () => {
    mockWithTenant.mockResolvedValueOnce([] as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/field-placements?status=completed",
      headers: registrarH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

// ------------------------------------------------------------------ GET /field-placements/:id

describe("GET /field-placements/:id", () => {
  it("returns 404 when record not found", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/field-placements/${PLACEMENT.id}`,
      headers: adminH,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns record by id", async () => {
    mockWithTenant.mockResolvedValueOnce(PLACEMENT as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/field-placements/${PLACEMENT.id}`,
      headers: adminH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(PLACEMENT);
  });
});

// ------------------------------------------------------------------ POST /field-placements

describe("POST /field-placements", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/field-placements",
      payload: validBody,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when role is instructor", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/field-placements",
      headers: instructorH,
      payload: validBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when role is finance", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/field-placements",
      headers: financeH,
      payload: validBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when student_id is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/field-placements",
      headers: registrarH,
      payload: { host_organisation: "Regional Hospital" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when host_organisation is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/field-placements",
      headers: registrarH,
      payload: { student_id: STUDENT_ID },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when student_id is not a valid UUID", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/field-placements",
      headers: registrarH,
      payload: { student_id: "not-a-uuid", host_organisation: "Regional Hospital" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when placement_type is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/field-placements",
      headers: registrarH,
      payload: {
        student_id: STUDENT_ID,
        host_organisation: "Regional Hospital",
        placement_type: "invalid-type",
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it("creates record and returns 201", async () => {
    mockWithTenant.mockResolvedValueOnce(PLACEMENT as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/field-placements",
      headers: { ...registrarH, "content-type": "application/json" },
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(PLACEMENT);
  });
});

// ------------------------------------------------------------------ PATCH /field-placements/:id

describe("PATCH /field-placements/:id", () => {
  it("returns 403 when role is instructor", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/field-placements/${PLACEMENT.id}`,
      headers: instructorH,
      payload: { status: "completed" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when record not found", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/field-placements/${PLACEMENT.id}`,
      headers: adminH,
      payload: { status: "completed" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("updates record and returns updated row", async () => {
    const updated = { ...PLACEMENT, status: "completed" };
    mockWithTenant.mockResolvedValueOnce(updated as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/field-placements/${PLACEMENT.id}`,
      headers: { ...adminH, "content-type": "application/json" },
      payload: { status: "completed" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("completed");
  });
});
