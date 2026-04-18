import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

// Mock the tenant transaction helper so tests don't need a real DB
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /students", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/students" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "x-tenant-id header required" });
  });

  it("returns student list from the DB", async () => {
    const fakeStudents = [
      {
        id: "uuid-1",
        first_name: "Alice",
        last_name: "Smith",
        date_of_birth: null,
        created_at: new Date().toISOString(),
      },
    ];
    mockWithTenant.mockResolvedValueOnce({ rows: fakeStudents } as never);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/students",
      headers: { "x-tenant-id": "tenant-uuid-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(fakeStudents);
    expect(mockWithTenant).toHaveBeenCalledWith(
      "tenant-uuid-1",
      expect.any(Function),
    );
  });

  it("filters by search query when provided", async () => {
    const fakeStudents = [
      {
        id: "uuid-s",
        first_name: "Alice",
        last_name: "Smith",
        date_of_birth: null,
        extension: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    mockWithTenant.mockResolvedValueOnce({ rows: fakeStudents } as never);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/students?search=Alice",
      headers: { "x-tenant-id": "tenant-uuid-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(fakeStudents);
  });
});

describe("POST /students", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/students",
      payload: { first_name: "Alice", last_name: "Smith" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 422 for invalid body", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/students",
      headers: { "x-tenant-id": "tenant-uuid-1" },
      payload: { first_name: "" }, // missing last_name, empty first_name
    });
    expect(res.statusCode).toBe(422);
  });

  it("creates and returns new student", async () => {
    const created = {
      id: "new-uuid",
      first_name: "Bob",
      last_name: "Jones",
      date_of_birth: null,
      created_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce({ rows: [created] } as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/students",
      headers: { "x-tenant-id": "tenant-uuid-1" },
      payload: { first_name: "Bob", last_name: "Jones" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(created);
  });

  it("returns 403 for a role that is not admin or registrar", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/students",
      headers: { "x-tenant-id": "tenant-uuid-1", "x-dev-role": "instructor" },
      payload: { first_name: "Bob", last_name: "Jones" },
    });
    expect(res.statusCode).toBe(403);
  });
});

const TID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SOME_ID = "11111111-1111-1111-1111-111111111111";
const MISSING_ID = "00000000-0000-0000-0000-000000000000";

describe("GET /students/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: `/students/${SOME_ID}` });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when student is not found", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/students/${MISSING_ID}`,
      headers: { "x-tenant-id": TID },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "student not found");
  });

  it("returns 200 with 360° student view when found", async () => {
    const fakeStudent360 = {
      id: TID,
      first_name: "Alice",
      last_name: "Smith",
      date_of_birth: null,
      extension: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      marks: [],
      admissions: [],
      term_registrations: [],
      industrial_training: [],
      field_placements: [],
      fees: { total_paid: 0, last_payment: null },
    };
    mockWithTenant.mockResolvedValueOnce(fakeStudent360 as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/students/${TID}`,
      headers: { "x-tenant-id": TID },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.first_name).toBe("Alice");
    expect(body).toHaveProperty("marks");
    expect(body).toHaveProperty("admissions");
    expect(body).toHaveProperty("term_registrations");
    expect(body).toHaveProperty("industrial_training");
    expect(body).toHaveProperty("field_placements");
    expect(body).toHaveProperty("fees");
  });
});

describe("PUT /students/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/students/${SOME_ID}`,
      payload: { first_name: "Alice" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for a role that is not admin or registrar", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/students/${SOME_ID}`,
      headers: { "x-tenant-id": TID, "x-dev-role": "hod" },
      payload: { first_name: "Alice" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when student not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/students/${MISSING_ID}`,
      headers: { "x-tenant-id": TID },
      payload: { first_name: "Alice" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "student not found");
  });

  it("returns 200 with updated student", async () => {
    const updated = {
      id: TID,
      first_name: "Alice",
      last_name: "Updated",
      date_of_birth: null,
      extension: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce({ rows: [updated] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/students/${TID}`,
      headers: { "x-tenant-id": TID },
      payload: { first_name: "Alice" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(updated);
  });
});

describe("PATCH /students/:id/deactivate", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/students/${SOME_ID}/deactivate`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for a role that is not admin or registrar", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/students/${SOME_ID}/deactivate`,
      headers: { "x-tenant-id": TID, "x-dev-role": "hod" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when student not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/students/${MISSING_ID}/deactivate`,
      headers: { "x-tenant-id": TID },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "student not found");
  });

  it("returns 200 with student marked is_active=false", async () => {
    const deactivated = {
      id: TID,
      first_name: "Alice",
      last_name: "Smith",
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce({ rows: [deactivated] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/students/${TID}/deactivate`,
      headers: { "x-tenant-id": TID },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ is_active: false });
  });
});

describe("PATCH /students/:id/reactivate", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/students/${SOME_ID}/reactivate`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for a role that is not admin or registrar", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/students/${SOME_ID}/reactivate`,
      headers: { "x-tenant-id": TID, "x-dev-role": "instructor" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 with student marked is_active=true", async () => {
    const reactivated = {
      id: TID,
      first_name: "Alice",
      last_name: "Smith",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce({ rows: [reactivated] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/students/${TID}/reactivate`,
      headers: { "x-tenant-id": TID },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ is_active: true });
  });
});

// ──────────────────────── GET /students/export/csv
describe("GET /students/export/csv", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/students/export/csv" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for an instructor role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/students/export/csv",
      headers: { "x-tenant-id": TID, "x-dev-role": "instructor" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns CSV with correct content-type", async () => {
    const fakeRows = [
      {
        id: "uuid-1", admission_number: "ADM001",
        first_name: "Alice", last_name: "Smith", other_names: null,
        gender: "F", date_of_birth: "2000-01-01", email: null, phone: null,
        programme: "NCBC", intake: "2025-Jan",
        nationality: "UG", district: "Kampala", county: "Central",
        guardian_name: "John", guardian_phone: "07001",
        is_active: true, created_at: "2026-01-01",
      },
    ];
    mockWithTenant.mockResolvedValueOnce({ rows: fakeRows } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/students/export/csv",
      headers: { "x-tenant-id": TID, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("students-export");
    expect(res.body).toContain("first_name");
    expect(res.body).toContain("Alice");
  });
});
