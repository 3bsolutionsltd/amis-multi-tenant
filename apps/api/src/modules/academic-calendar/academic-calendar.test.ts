import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000040";
const registrarHeaders = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const instructorHeaders = { "x-tenant-id": TID, "x-dev-role": "instructor" };
const headers = { "x-tenant-id": TID };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const fakeAcademicYear = {
  id: "aa000000-0000-0000-0000-000000000001",
  tenant_id: TID,
  name: "2025/2026",
  start_date: "2025-09-01",
  end_date: "2026-08-31",
  is_current: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const fakeTerm = {
  id: "bb000000-0000-0000-0000-000000000001",
  tenant_id: TID,
  academic_year_id: fakeAcademicYear.id,
  name: "Term 1",
  term_number: 1,
  start_date: "2025-09-01",
  end_date: "2025-12-20",
  is_current: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ================================================================== Academic Years

describe("POST /academic-years", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/academic-years",
      payload: { name: "2025/2026", start_date: "2025-09-01", end_date: "2026-08-31" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when role is not registrar or admin", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/academic-years",
      headers: instructorHeaders,
      payload: { name: "2025/2026", start_date: "2025-09-01", end_date: "2026-08-31" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/academic-years",
      headers: registrarHeaders,
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 201 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeAcademicYear] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/academic-years",
      headers: registrarHeaders,
      payload: { name: "2025/2026", start_date: "2025-09-01", end_date: "2026-08-31" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "2025/2026" });
  });
});

describe("GET /academic-years", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/academic-years" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeAcademicYear] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/academic-years",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 200 with admin role", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/academic-years",
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /academic-years/:id", () => {
  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/academic-years/${fakeAcademicYear.id}`,
      headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeAcademicYear] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/academic-years/${fakeAcademicYear.id}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: "2025/2026" });
  });
});

describe("PATCH /academic-years/:id", () => {
  it("returns 422 when no fields provided", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/academic-years/${fakeAcademicYear.id}`,
      headers: registrarHeaders,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/academic-years/${fakeAcademicYear.id}`,
      headers: registrarHeaders,
      payload: { name: "2026/2027" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ ...fakeAcademicYear, name: "2026/2027" }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/academic-years/${fakeAcademicYear.id}`,
      headers: registrarHeaders,
      payload: { name: "2026/2027" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("2026/2027");
  });
});

// ================================================================== Terms

describe("POST /terms", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/terms",
      payload: {
        academic_year_id: fakeAcademicYear.id,
        name: "Term 1",
        term_number: 1,
        start_date: "2025-09-01",
        end_date: "2025-12-20",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for instructor role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/terms",
      headers: instructorHeaders,
      payload: {
        academic_year_id: fakeAcademicYear.id,
        name: "Term 1",
        term_number: 1,
        start_date: "2025-09-01",
        end_date: "2025-12-20",
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/terms",
      headers: registrarHeaders,
      payload: { name: "Term 1" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 201 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeTerm] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/terms",
      headers: registrarHeaders,
      payload: {
        academic_year_id: fakeAcademicYear.id,
        name: "Term 1",
        term_number: 1,
        start_date: "2025-09-01",
        end_date: "2025-12-20",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "Term 1", term_number: 1 });
  });
});

describe("GET /terms", () => {
  it("returns 200 with list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeTerm] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/terms",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 200 with academic_year_id filter", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeTerm] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/terms?academic_year_id=${fakeAcademicYear.id}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /terms/:id", () => {
  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/terms/${fakeTerm.id}`,
      headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeTerm] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/terms/${fakeTerm.id}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: "Term 1" });
  });
});

describe("PATCH /terms/:id", () => {
  it("returns 422 when no fields provided", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/terms/${fakeTerm.id}`,
      headers: registrarHeaders,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ ...fakeTerm, name: "Semester 1" }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/terms/${fakeTerm.id}`,
      headers: registrarHeaders,
      payload: { name: "Semester 1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Semester 1");
  });
});
