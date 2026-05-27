import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

vi.mock("../../lib/workflowDef.js", () => ({
  loadWorkflowDef: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
import { loadWorkflowDef } from "../../lib/workflowDef.js";
const mockWithTenant = vi.mocked(withTenant);
const mockLoadWorkflowDef = vi.mocked(loadWorkflowDef);

const TID = "00000000-0000-0000-0000-000000000030";
const headers = { "x-tenant-id": TID };
const registrarHeaders = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const hodHeaders = { "x-tenant-id": TID, "x-dev-role": "hod" };
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const financeHeaders = { "x-tenant-id": TID, "x-dev-role": "finance" };

beforeEach(() => {
  vi.resetAllMocks();
  mockLoadWorkflowDef.mockResolvedValue({
    key: "term_registration",
    initial_state: "REGISTRATION_STARTED",
    states: [],
    transitions: [],
  });
});

// ------------------------------------------------------------------ stub data

const fakeStudent = {
  id: "00000000-0000-0000-0000-000000000001",
};

const fakeRegistration = {
  id: "ee000000-0000-0000-0000-000000000001",
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

  it("returns 200 when filtering by term_id UUID (#85)", async () => {
    const TERM_ID = "aa000000-0000-0000-0000-000000000001";
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeRegistration] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/term-registrations?term_id=${TERM_ID}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 422 when term_id filter is not a valid UUID (#85)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/term-registrations?term_id=not-a-uuid",
      headers,
    });
    expect(res.statusCode).toBe(422);
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

// ------------------------------------------------------------------ POST /term-registrations/bulk

describe("POST /term-registrations/bulk", () => {
  it("skips rows that conflict during insert instead of returning 500", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "ay-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "term-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: fakeStudent.id }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockWithTenant.mockImplementationOnce(async (_tid, callback) =>
      callback({ query } as never),
    );

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations/bulk",
      headers: registrarHeaders,
      payload: {
        academic_year: "2026/2027",
        term: "Term 1",
        student_ids: [fakeStudent.id],
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ created: 0, skipped: 1, errors: [] });
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("workflow_instances"),
      expect.anything(),
    );
  });
});

// ------------------------------------------------------------------ POST /term-registrations/promote

describe("POST /term-registrations/promote", () => {
  it("ignores insert conflicts while registering all active students", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: fakeStudent.id }] })
      .mockResolvedValueOnce({ rows: [{ id: "ay-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "term-1" }] })
      .mockResolvedValueOnce({ rows: [] });

    mockWithTenant.mockImplementationOnce(async (_tid, callback) =>
      callback({ query } as never),
    );

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/term-registrations/promote",
      headers: registrarHeaders,
      payload: {
        academic_year: "2026/2027",
        term: "Term 1",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      created: 0,
      total_active_students: 1,
    });
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("workflow_instances"),
      expect.anything(),
    );
  });
});
