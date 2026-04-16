import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000020";
const headers = { "x-tenant-id": TID };
const instructorHeaders = { "x-tenant-id": TID, "x-dev-role": "instructor" };
const hodHeaders = { "x-tenant-id": TID, "x-dev-role": "hod" };
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const fakeSubmission = {
  id: "ssss0000-0000-0000-0000-000000000001",
  tenant_id: TID,
  course_id: "CS101",
  programme: "Computer Science",
  intake: "2026-01",
  term: "Term 1",
  created_by: "00000000-0000-0000-0000-000000000004",
  created_at: new Date().toISOString(),
  correction_of_submission_id: null,
  current_state: "DRAFT",
};

const fakeEntry = {
  id: "eeee0000-0000-0000-0000-000000000001",
  tenant_id: TID,
  submission_id: fakeSubmission.id,
  student_id: "ab000000-0000-0000-0000-000000000001",
  score: "85",
  updated_by: "00000000-0000-0000-0000-000000000004",
  updated_at: new Date().toISOString(),
};

const validSubmissionBody = {
  course_id: "CS101",
  programme: "Computer Science",
  intake: "2026-01",
  term: "Term 1",
};

const validEntriesBody = {
  entries: [{ student_id: "ab000000-0000-0000-0000-000000000001", score: 85 }],
};

// ------------------------------------------------------------------ POST /marks/submissions

describe("POST /marks/submissions", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/marks/submissions",
      payload: validSubmissionBody,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is not instructor or admin", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/marks/submissions",
      headers: hodHeaders,
      payload: validSubmissionBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid (missing required fields)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/marks/submissions",
      headers: instructorHeaders,
      payload: { course_id: "CS101" }, // missing programme, intake, term
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when workflow not found in published config", async () => {
    mockWithTenant.mockResolvedValueOnce({
      configError: true,
      message: 'workflow "marks" not found in published config',
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/marks/submissions",
      headers: instructorHeaders,
      payload: validSubmissionBody,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatch(/marks/);
  });

  it("returns 201 with submission and workflowState on success", async () => {
    mockWithTenant.mockResolvedValueOnce({
      submission: fakeSubmission,
      workflowState: "DRAFT",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/marks/submissions",
      headers: instructorHeaders,
      payload: validSubmissionBody,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      submission: { course_id: "CS101", current_state: "DRAFT" },
      workflowState: "DRAFT",
    });
  });
});

// ------------------------------------------------------------------ PUT /marks/submissions/:id/entries

describe("PUT /marks/submissions/:id/entries", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/marks/submissions/${fakeSubmission.id}/entries`,
      payload: validEntriesBody,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is not instructor or admin", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/marks/submissions/${fakeSubmission.id}/entries`,
      headers: hodHeaders,
      payload: validEntriesBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when entries body is invalid (empty array)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/marks/submissions/${fakeSubmission.id}/entries`,
      headers: instructorHeaders,
      payload: { entries: [] }, // min(1) violated
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 404 when submission does not exist", async () => {
    mockWithTenant.mockResolvedValueOnce({ notFound: true } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/marks/submissions/nonexistent-id/entries",
      headers: instructorHeaders,
      payload: validEntriesBody,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "submission not found");
  });

  it("returns 409 when submission is in PUBLISHED state", async () => {
    mockWithTenant.mockResolvedValueOnce({ published: true } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/marks/submissions/${fakeSubmission.id}/entries`,
      headers: instructorHeaders,
      payload: validEntriesBody,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/PUBLISHED/);
  });

  it("returns 200 with updated entries on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ entries: [fakeEntry] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/marks/submissions/${fakeSubmission.id}/entries`,
      headers: adminHeaders,
      payload: validEntriesBody,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      entries: [{ submission_id: fakeSubmission.id }],
    });
  });
});

// ------------------------------------------------------------------ GET /marks/submissions

describe("GET /marks/submissions", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/marks/submissions",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 200 with list including current_state from workflow", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeSubmission] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/marks/submissions",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([fakeSubmission]);
  });

  it("returns 200 with filtered list by course_id and term", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeSubmission] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/marks/submissions?course_id=CS101&term=Term+1",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 200 with filtered list by current_state", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeSubmission] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/marks/submissions?current_state=DRAFT",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});

// ------------------------------------------------------------------ GET /marks/submissions/:id

describe("GET /marks/submissions/:id", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/marks/submissions/some-id",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 404 when submission does not exist", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/marks/submissions/nonexistent-id",
      headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "not found");
  });

  it("returns 200 with submission, entries, and current_state", async () => {
    const submWithEntries = { ...fakeSubmission, entries: [fakeEntry] };
    mockWithTenant.mockResolvedValueOnce(submWithEntries as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/marks/submissions/${fakeSubmission.id}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: fakeSubmission.id,
      current_state: "DRAFT",
      entries: [{ submission_id: fakeSubmission.id }],
    });
  });
});

// ------------------------------------------------------------------ GET /marks/submissions/:id/audit (SR-F-022)

describe("GET /marks/submissions/:id/audit", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/marks/submissions/${fakeSubmission.id}/audit`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 for finance role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/marks/submissions/${fakeSubmission.id}/audit`,
      headers: { "x-tenant-id": TID, "x-dev-role": "finance" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when submission not found in tenant", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/marks/submissions/${fakeSubmission.id}/audit`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns audit log entries", async () => {
    const auditEntry = {
      id: "aa000000-0000-0000-0000-000000000001",
      entry_id: fakeEntry.id,
      student_id: fakeEntry.student_id,
      old_score: null,
      new_score: 85,
      actor_user_id: null,
      changed_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce([auditEntry] as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/marks/submissions/${fakeSubmission.id}/audit`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([auditEntry]);
  });
});
