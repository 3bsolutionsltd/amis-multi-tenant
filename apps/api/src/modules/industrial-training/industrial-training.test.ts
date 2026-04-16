import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "cc000000-0000-0000-0000-000000000001";
const adminH = { "x-tenant-id": TID, "x-dev-role": "admin" };
const registrarH = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const instructorH = { "x-tenant-id": TID, "x-dev-role": "instructor" };
const financeH = { "x-tenant-id": TID, "x-dev-role": "finance" };

const STUDENT_ID = "cc000000-0000-0000-0000-000000000010";

const TRAINING = {
  id: "cc000000-0000-0000-0000-000000000020",
  tenant_id: TID,
  student_id: STUDENT_ID,
  company: "Acme Corp",
  supervisor: "John Doe",
  department: "Engineering",
  start_date: "2026-01-15",
  end_date: "2026-06-30",
  status: "active",
  notes: null,
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  first_name: "Alice",
  last_name: "Mokoena",
};

const validBody = {
  student_id: STUDENT_ID,
  company: "Acme Corp",
};

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ GET /industrial-training

describe("GET /industrial-training", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/industrial-training" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns list from DB", async () => {
    mockWithTenant.mockResolvedValueOnce([TRAINING] as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/industrial-training",
      headers: adminH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([TRAINING]);
  });

  it("returns 403 for finance role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/industrial-training",
      headers: financeH,
    });
    expect(res.statusCode).toBe(403);
  });

  it("supports status filter", async () => {
    mockWithTenant.mockResolvedValueOnce([] as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/industrial-training?status=completed",
      headers: registrarH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

// ------------------------------------------------------------------ GET /industrial-training/:id

describe("GET /industrial-training/:id", () => {
  it("returns 404 when record not found", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/industrial-training/${TRAINING.id}`,
      headers: adminH,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns record by id", async () => {
    mockWithTenant.mockResolvedValueOnce(TRAINING as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/industrial-training/${TRAINING.id}`,
      headers: adminH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(TRAINING);
  });
});

// ------------------------------------------------------------------ POST /industrial-training

describe("POST /industrial-training", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/industrial-training",
      payload: validBody,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when role is instructor", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/industrial-training",
      headers: instructorH,
      payload: validBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when student_id is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/industrial-training",
      headers: registrarH,
      payload: { company: "Acme Corp" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when company is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/industrial-training",
      headers: registrarH,
      payload: { student_id: STUDENT_ID },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when student_id is not a valid UUID", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/industrial-training",
      headers: registrarH,
      payload: { student_id: "not-a-uuid", company: "Acme Corp" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("creates record and returns 201", async () => {
    mockWithTenant.mockResolvedValueOnce(TRAINING as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/industrial-training",
      headers: { ...registrarH, "content-type": "application/json" },
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(TRAINING);
  });
});

// ------------------------------------------------------------------ PATCH /industrial-training/:id

describe("PATCH /industrial-training/:id", () => {
  it("returns 403 when role is instructor", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/industrial-training/${TRAINING.id}`,
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
      url: `/industrial-training/${TRAINING.id}`,
      headers: adminH,
      payload: { status: "completed" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("updates record and returns updated row", async () => {
    const updated = { ...TRAINING, status: "completed" };
    mockWithTenant.mockResolvedValueOnce(updated as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/industrial-training/${TRAINING.id}`,
      headers: { ...adminH, "content-type": "application/json" },
      payload: { status: "completed" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("completed");
  });
});
