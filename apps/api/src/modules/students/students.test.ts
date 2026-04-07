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

const TID = "tenant-uuid-1";

describe("GET /students/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/students/some-id" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when student is not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/students/nonexistent",
      headers: { "x-tenant-id": TID },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "student not found");
  });

  it("returns 200 with student when found", async () => {
    const fakeStudent = {
      id: TID,
      first_name: "Alice",
      last_name: "Smith",
      date_of_birth: null,
      extension: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeStudent] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/students/${TID}`,
      headers: { "x-tenant-id": TID },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(fakeStudent);
  });
});

describe("PUT /students/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/students/some-id",
      payload: { first_name: "Alice" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for a role that is not admin or registrar", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/students/some-id",
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
      url: "/students/nonexistent",
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
