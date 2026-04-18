import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TENANT = "ab000000-0000-0000-0000-000000000001";
const IT_ID = "ab000000-0000-0000-0000-000000000030";
const STAFF_ID = "ab000000-0000-0000-0000-000000000031";
const STUDENT_ID = "ab000000-0000-0000-0000-000000000032";
const RPT_ID = "ab000000-0000-0000-0000-000000000033";
const EVAL_ID = "ab000000-0000-0000-0000-000000000034";
const INST_RPT_ID = "ab000000-0000-0000-0000-000000000035";

const IT_REPORT = {
  id: RPT_ID,
  tenant_id: TENANT,
  industrial_training_id: IT_ID,
  report_type: "student",
  period: "Week 1",
  summary: "Good progress",
  challenges: null,
  recommendations: null,
  rating: 4,
  submitted_by: "Student A",
  submitted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const EVAL = {
  id: EVAL_ID,
  tenant_id: TENANT,
  student_id: STUDENT_ID,
  staff_id: STAFF_ID,
  academic_period: "2025/26 Sem 1",
  scores: { teaching_quality: 4, communication: 5 },
  comments: "Great lecturer",
  submitted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const INST_REPORT = {
  id: INST_RPT_ID,
  tenant_id: TENANT,
  staff_id: STAFF_ID,
  report_type: "weekly",
  period: "2026-W15",
  content: "Covered chapter 3 and 4",
  status: "draft",
  due_date: "2026-04-18",
  submitted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ════════════════════════════════ GET /reports/it
describe("GET /reports/it", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/reports/it" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns IT report list from DB", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [IT_REPORT] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/reports/it",
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([IT_REPORT]);
  });

  it("supports filtering by industrial_training_id", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [IT_REPORT] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/reports/it?industrial_training_id=${IT_ID}`,
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([IT_REPORT]);
  });
});

// ════════════════════════════════ GET /reports/it/:id
describe("GET /reports/it/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when IT report not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/reports/it/${RPT_ID}`,
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns single IT report", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [IT_REPORT] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/reports/it/${RPT_ID}`,
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(RPT_ID);
  });
});

// ════════════════════════════════ POST /reports/it
describe("POST /reports/it", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates an IT report", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [IT_REPORT] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/reports/it",
      headers: { "x-tenant-id": TENANT, "content-type": "application/json" },
      payload: {
        industrial_training_id: IT_ID,
        report_type: "student",
        period: "Week 1",
        summary: "Good progress",
        rating: 4,
        submitted_by: "Student A",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(RPT_ID);
  });

  it("returns 422 for missing required fields", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/reports/it",
      headers: { "x-tenant-id": TENANT, "content-type": "application/json" },
      payload: { report_type: "student" },
    });
    expect(res.statusCode).toBe(422);
  });
});

// ════════════════════════════════ GET /reports/evaluations
describe("GET /reports/evaluations", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/reports/evaluations",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns evaluations list from DB", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [EVAL] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/reports/evaluations",
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([EVAL]);
  });
});

// ════════════════════════════════ POST /reports/evaluations
describe("POST /reports/evaluations", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a teacher evaluation", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [EVAL] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/reports/evaluations",
      headers: { "x-tenant-id": TENANT, "content-type": "application/json" },
      payload: {
        student_id: STUDENT_ID,
        staff_id: STAFF_ID,
        academic_period: "2025/26 Sem 1",
        scores: { teaching_quality: 4, communication: 5 },
        comments: "Great lecturer",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(EVAL_ID);
  });

  it("returns 422 for invalid payload", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/reports/evaluations",
      headers: { "x-tenant-id": TENANT, "content-type": "application/json" },
      payload: { student_id: "not-a-uuid", academic_period: "" },
    });
    expect(res.statusCode).toBe(422);
  });
});

// ════════════════════════════════ GET /reports/instructor
describe("GET /reports/instructor", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/reports/instructor",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns instructor report list from DB", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [INST_REPORT] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/reports/instructor",
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([INST_REPORT]);
  });

  it("filters by status=draft", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [INST_REPORT] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/reports/instructor?status=draft",
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([INST_REPORT]);
  });
});

// ════════════════════════════════ POST /reports/instructor
describe("POST /reports/instructor", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates an instructor report", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [INST_REPORT] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/reports/instructor",
      headers: { "x-tenant-id": TENANT, "content-type": "application/json" },
      payload: {
        staff_id: STAFF_ID,
        report_type: "weekly",
        period: "2026-W15",
        content: "Covered chapter 3 and 4",
        due_date: "2026-04-18",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(INST_RPT_ID);
  });

  it("returns 422 for missing required fields", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/reports/instructor",
      headers: { "x-tenant-id": TENANT, "content-type": "application/json" },
      payload: { report_type: "weekly" },
    });
    expect(res.statusCode).toBe(422);
  });
});

// ════════════════════════════════ PATCH /reports/instructor/:id
describe("PATCH /reports/instructor/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when report not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/reports/instructor/${INST_RPT_ID}`,
      headers: { "x-tenant-id": TENANT, "content-type": "application/json" },
      payload: { status: "submitted" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("submits an instructor report", async () => {
    const submitted = {
      ...INST_REPORT,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce({ rows: [submitted] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/reports/instructor/${INST_RPT_ID}`,
      headers: { "x-tenant-id": TENANT, "content-type": "application/json" },
      payload: { status: "submitted" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("submitted");
  });
});

// ════════════════════════════════ GET /reports/cat-export
describe("GET /reports/cat-export", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/reports/cat-export" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns CSV with correct content-type for admin", async () => {
    const catRows = [
      {
        student_id: "s1", admission_number: "ADM01",
        first_name: "Alice", last_name: "Smith",
        programme: "NCBC", course_id: "CIT101", term: "1", intake: "2025-Jan",
        score: 85, submission_state: "PUBLISHED",
      },
    ];
    mockWithTenant.mockResolvedValueOnce(catRows as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/reports/cat-export",
      headers: { "x-tenant-id": TENANT, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.body).toContain("student_id");
    expect(res.body).toContain("Alice");
  });
});

// ════════════════════════════════ GET /reports/dropout-cohort
describe("GET /reports/dropout-cohort", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/reports/dropout-cohort" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 for instructor role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/reports/dropout-cohort",
      headers: { "x-tenant-id": TENANT, "x-dev-role": "instructor" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns dropout cohort data for admin", async () => {
    const cohortData = {
      by_programme: [{ programme: "NCBC", dropped_count: 3 }],
      by_reason: [{ reason: "academic", count: 2 }],
      by_period: [{ month: "2026-01", count: 1 }],
      cohort: { total: 50, active: 45, dropped: 3, deactivated: 2 },
    };
    mockWithTenant.mockResolvedValueOnce(cohortData as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/reports/dropout-cohort",
      headers: { "x-tenant-id": TENANT, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("by_programme");
    expect(body).toHaveProperty("by_reason");
    expect(body).toHaveProperty("by_period");
    expect(body).toHaveProperty("cohort");
  });
});
