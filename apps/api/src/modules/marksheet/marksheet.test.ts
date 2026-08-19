import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000030";
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };

beforeEach(() => vi.resetAllMocks());

function fakeClientFor(opts: {
  course?: { title: string }[];
  assessments?: unknown[];
  entries?: unknown[];
  roster?: unknown[];
  boundaries?: unknown[];
}) {
  return {
    query: vi.fn((sql: string) => {
      if (sql.includes("FROM app.courses")) return Promise.resolve({ rows: opts.course ?? [] });
      if (sql.includes("FROM app.mark_submissions")) return Promise.resolve({ rows: opts.assessments ?? [] });
      if (sql.includes("FROM app.mark_entries")) return Promise.resolve({ rows: opts.entries ?? [] });
      if (sql.includes("FROM app.students")) return Promise.resolve({ rows: opts.roster ?? [] });
      if (sql.includes("FROM app.grade_boundaries")) return Promise.resolve({ rows: opts.boundaries ?? [] });
      return Promise.resolve({ rows: [] });
    }),
  };
}

const validQuery = "course_id=101&intake=2026%2F2027&term=Term+1&programme=DICT";

describe("GET /marksheet", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: `/marksheet?${validQuery}` });
    expect(res.statusCode).toBe(400);
  });

  it("returns 422 when required query params are missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/marksheet?course_id=101",
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns a pivoted marksheet with computed totals and grades", async () => {
    mockWithTenant.mockImplementationOnce(async (_tid, cb) => {
      const client = fakeClientFor({
        course: [{ title: "Building and Construction" }],
        assessments: [
          { submission_id: "sub-1", assessment_type: "test_1", weight: 50, assessment_date: null, current_state: "PUBLISHED" },
          { submission_id: "sub-2", assessment_type: "end_of_term", weight: 50, assessment_date: null, current_state: "PUBLISHED" },
        ],
        entries: [
          { submission_id: "sub-1", student_id: "stu-1", score: "80" },
          { submission_id: "sub-2", student_id: "stu-1", score: "60" },
        ],
        roster: [
          { id: "stu-1", first_name: "Jane", last_name: "Doe", admission_number: "ADM-001" },
        ],
        boundaries: [
          { min_score: "70", max_score: "100", grade_letter: "D1" },
          { min_score: "0", max_score: "69.9", grade_letter: "F" },
        ],
      });
      return cb(client as never);
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/marksheet?${validQuery}`,
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.course).toMatchObject({ code: "101", title: "Building and Construction" });
    expect(body.assessments).toHaveLength(2);
    expect(body.students).toHaveLength(1);
    // 80*0.5 + 60*0.5 = 70
    expect(body.students[0].total).toBe(70);
    expect(body.students[0].grade).toBe("D1");
  });
});

describe("GET /marksheet/export", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: `/marksheet/export?${validQuery}` });
    expect(res.statusCode).toBe(400);
  });

  it("returns a CSV file with student rows", async () => {
    mockWithTenant.mockImplementationOnce(async (_tid, cb) => {
      const client = fakeClientFor({
        course: [{ title: "Building and Construction" }],
        assessments: [
          { submission_id: "sub-1", assessment_type: "test_1", weight: 100, assessment_date: null, current_state: "PUBLISHED" },
        ],
        entries: [{ submission_id: "sub-1", student_id: "stu-1", score: "90" }],
        roster: [{ id: "stu-1", first_name: "Jane", last_name: "Doe", admission_number: "ADM-001" }],
        boundaries: [{ min_score: "70", max_score: "100", grade_letter: "D1" }],
      });
      return cb(client as never);
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/marksheet/export?${validQuery}&template=uvtab`,
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.body).toContain("Doe, Jane");
    expect(res.body).toContain("D1");
  });
});
