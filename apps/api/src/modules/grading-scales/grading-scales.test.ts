import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000042";
const registrarHeaders = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const instructorHeaders = { "x-tenant-id": TID, "x-dev-role": "instructor" };
const headers = { "x-tenant-id": TID };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const fakeScale = {
  id: "ff000000-0000-0000-0000-000000000001",
  tenant_id: TID,
  name: "UBTEB Standard",
  is_default: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const fakeBoundary = {
  id: "ee000000-0000-0000-0000-000000000001",
  grading_scale_id: fakeScale.id,
  grade_letter: "D1",
  description: "Distinction",
  min_score: 80,
  max_score: 100,
  grade_point: 1,
  created_at: new Date().toISOString(),
};

// ================================================================== Grading Scales

describe("POST /grading-scales", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/grading-scales",
      payload: { name: "UBTEB Standard" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for instructor role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/grading-scales",
      headers: instructorHeaders,
      payload: { name: "UBTEB Standard" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/grading-scales",
      headers: registrarHeaders,
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 201 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeScale] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/grading-scales",
      headers: registrarHeaders,
      payload: { name: "UBTEB Standard", is_default: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "UBTEB Standard" });
  });
});

describe("GET /grading-scales", () => {
  it("returns 200 with list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeScale] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/grading-scales",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});

describe("GET /grading-scales/:id", () => {
  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/grading-scales/${fakeScale.id}`,
      headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 with boundaries on success", async () => {
    mockWithTenant.mockResolvedValueOnce({
      ...fakeScale,
      boundaries: [fakeBoundary],
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/grading-scales/${fakeScale.id}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("UBTEB Standard");
    expect(body.boundaries).toHaveLength(1);
  });
});

describe("PATCH /grading-scales/:id", () => {
  it("returns 422 when no fields provided", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/grading-scales/${fakeScale.id}`,
      headers: registrarHeaders,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ ...fakeScale, name: "Updated" }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/grading-scales/${fakeScale.id}`,
      headers: adminHeaders,
      payload: { name: "Updated" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Updated");
  });
});

// ================================================================== Grade Boundaries

describe("POST /grading-scales/:id/boundaries (bulk)", () => {
  it("returns 422 when body is not array", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/grading-scales/${fakeScale.id}/boundaries`,
      headers: registrarHeaders,
      payload: { grade_letter: "D1" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 404 when scale not found", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/grading-scales/${fakeScale.id}/boundaries`,
      headers: registrarHeaders,
      payload: [
        { grade_letter: "D1", min_score: 80, max_score: 100 },
      ],
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 201 on success", async () => {
    mockWithTenant.mockResolvedValueOnce([fakeBoundary] as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/grading-scales/${fakeScale.id}/boundaries`,
      headers: registrarHeaders,
      payload: [
        { grade_letter: "D1", description: "Distinction", min_score: 80, max_score: 100, grade_point: 1 },
      ],
    });
    expect(res.statusCode).toBe(201);
  });
});

describe("PATCH /grading-scales/:scaleId/boundaries/:boundaryId", () => {
  it("returns 422 when no fields provided", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/grading-scales/${fakeScale.id}/boundaries/${fakeBoundary.id}`,
      headers: registrarHeaders,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ ...fakeBoundary, min_score: 85 }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/grading-scales/${fakeScale.id}/boundaries/${fakeBoundary.id}`,
      headers: registrarHeaders,
      payload: { min_score: 85 },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("DELETE /grading-scales/:scaleId/boundaries/:boundaryId", () => {
  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/grading-scales/${fakeScale.id}/boundaries/${fakeBoundary.id}`,
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 204 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ id: fakeBoundary.id }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/grading-scales/${fakeScale.id}/boundaries/${fakeBoundary.id}`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(204);
  });
});
