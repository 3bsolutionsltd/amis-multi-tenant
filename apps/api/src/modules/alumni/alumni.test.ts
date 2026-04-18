import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000040";
const STUDENT_ID = "ab000000-0000-0000-0000-000000000001";
const ALUMNI_ID = "ac000000-0000-0000-0000-000000000001";

const registrarHeaders = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const hodHeaders = { "x-tenant-id": TID, "x-dev-role": "hod" };
const instructorHeaders = { "x-tenant-id": TID, "x-dev-role": "instructor" };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const fakeStudent = {
  id: STUDENT_ID,
  first_name: "Alice",
  last_name: "Nakamya",
  programme: "Electrical Engineering",
  admission_number: "ADM-2024-001",
  is_active: true,
};

const fakeAlumni = {
  id: ALUMNI_ID,
  tenant_id: TID,
  student_id: STUDENT_ID,
  first_name: "Alice",
  last_name: "Nakamya",
  programme: "Electrical Engineering",
  admission_number: "ADM-2024-001",
  graduation_date: "2026-04-01",
  graduation_notes: "First class honours",
  graduated_by: null,
  created_at: new Date().toISOString(),
};

// ------------------------------------------------------------------ POST /students/:id/graduate

describe("POST /students/:id/graduate", () => {
  const validBody = {
    graduation_date: "2026-04-01",
    graduation_notes: "First class honours",
  };

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/students/${STUDENT_ID}/graduate`,
      payload: validBody,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when role is instructor", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/students/${STUDENT_ID}/graduate`,
      headers: instructorHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/students/${STUDENT_ID}/graduate`,
      headers: registrarHeaders,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 404 when student not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ notFound: true } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/students/${STUDENT_ID}/graduate`,
      headers: registrarHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 409 when student already inactive", async () => {
    mockWithTenant.mockResolvedValueOnce({ alreadyInactive: true } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/students/${STUDENT_ID}/graduate`,
      headers: registrarHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 201 with alumni record on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ alumni: fakeAlumni } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/students/${STUDENT_ID}/graduate`,
      headers: adminHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      alumni: { first_name: "Alice", graduation_date: "2026-04-01" },
    });
  });
});

// ------------------------------------------------------------------ GET /alumni

describe("GET /alumni", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/alumni" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when role is instructor", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/alumni",
      headers: instructorHeaders,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns alumni list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeAlumni] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/alumni",
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0]).toMatchObject({ first_name: "Alice" });
  });

  it("returns empty list when no alumni", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/alumni",
      headers: hodHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

// ------------------------------------------------------------------ GET /alumni/:id

describe("GET /alumni/:id", () => {
  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/alumni/${ALUMNI_ID}`,
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns alumni detail", async () => {
    mockWithTenant.mockResolvedValueOnce(fakeAlumni as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/alumni/${ALUMNI_ID}`,
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ first_name: "Alice" });
  });
});

// ------------------------------------------------------------------ GET /alumni/export/csv

describe("GET /alumni/export/csv", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/alumni/export/csv" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when role is hod", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/alumni/export/csv",
      headers: hodHeaders,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns CSV content", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeAlumni] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/alumni/export/csv",
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.body).toContain("first_name,last_name");
    expect(res.body).toContain("Alice");
  });
});
