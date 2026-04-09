import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000030";
const headers = { "x-tenant-id": TID };
const registrarHeaders = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const hodHeaders = { "x-tenant-id": TID, "x-dev-role": "hod" };
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const financeHeaders = { "x-tenant-id": TID, "x-dev-role": "finance" };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const fakeStudent = {
  id: "00000000-0000-0000-0000-000000000001",
};

const fakeRegistration = {
  id: "reg00000-0000-0000-0000-000000000001",
  tenant_id: TID,
  student_id: fakeStudent.id,
  academic_year: "2026/2027",
  term: "Term 1",
  extension: {},
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  first_name: "Jane",
  last_name: "Doe",
  admission_number: "ADM/2026/001",
  student_programme: "NCBC",
  current_state: "REGISTRATION_STARTED",
};

const validBody = {
  student_id: fakeStudent.id,
  academic_year: "2026/2027",
  term: "Term 1",
};

// ------------------------------------------------------------------ POST /term-registrations

describe("POST /term-registrations", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations",
      payload: validBody,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is not registrar or admin", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations",
      headers: hodHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid (missing required fields)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations",
      headers: registrarHeaders,
      payload: { academic_year: "2026/2027" }, // missing student_id and term
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when student_id is not a valid UUID", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations",
      headers: registrarHeaders,
      payload: {
        student_id: "not-a-uuid",
        academic_year: "2026/2027",
        term: "Term 1",
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when workflow not found in published config", async () => {
    mockWithTenant.mockResolvedValueOnce({
      configError: true,
      message: 'workflow "term_registration" not found in published config',
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations",
      headers: registrarHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatch(/term_registration/);
  });

  it("returns 404 when student does not exist", async () => {
    mockWithTenant.mockResolvedValueOnce({
      notFound: true,
      message: "student not found",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations",
      headers: registrarHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "student not found");
  });

  it("returns 201 with registration and workflowState on success", async () => {
    mockWithTenant.mockResolvedValueOnce({
      registration: fakeRegistration,
      workflowState: "REGISTRATION_STARTED",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations",
      headers: registrarHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      registration: {
        student_id: fakeStudent.id,
        academic_year: "2026/2027",
        term: "Term 1",
        current_state: "REGISTRATION_STARTED",
      },
      workflowState: "REGISTRATION_STARTED",
    });
  });

  it("returns 201 when called with admin role", async () => {
    mockWithTenant.mockResolvedValueOnce({
      registration: fakeRegistration,
      workflowState: "REGISTRATION_STARTED",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations",
      headers: adminHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
  });
});

// ------------------------------------------------------------------ GET /term-registrations

describe("GET /term-registrations", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/term-registrations",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 200 with list of registrations", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeRegistration] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/term-registrations",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([fakeRegistration]);
  });

  it("returns 200 with filtered list by academic_year and term", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeRegistration] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/term-registrations?academic_year=2026%2F2027&term=Term+1`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 200 with filtered list by current_state", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeRegistration] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/term-registrations?current_state=REGISTRATION_STARTED",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0]).toHaveProperty(
      "current_state",
      "REGISTRATION_STARTED",
    );
  });

  it("returns 200 for finance role (read-only access allowed)", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/term-registrations",
      headers: financeHeaders,
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 200 with empty list when no registrations match", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/term-registrations?student_id=00000000-0000-0000-0000-000000000099",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

// ------------------------------------------------------------------ GET /term-registrations/:id

describe("GET /term-registrations/:id", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/term-registrations/${fakeRegistration.id}`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 404 when registration does not exist", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/term-registrations/00000000-0000-0000-0000-000000000099",
      headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "not found");
  });

  it("returns 200 with registration detail and student info on success", async () => {
    mockWithTenant.mockResolvedValueOnce(fakeRegistration as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/term-registrations/${fakeRegistration.id}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: fakeRegistration.id,
      student_id: fakeStudent.id,
      academic_year: "2026/2027",
      term: "Term 1",
      first_name: "Jane",
      last_name: "Doe",
      current_state: "REGISTRATION_STARTED",
    });
  });

  it("returns 200 for hod role", async () => {
    mockWithTenant.mockResolvedValueOnce(fakeRegistration as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/term-registrations/${fakeRegistration.id}`,
      headers: hodHeaders,
    });
    expect(res.statusCode).toBe(200);
  });
});
