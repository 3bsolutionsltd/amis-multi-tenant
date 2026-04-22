import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000010";
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const instructorHeaders = { "x-tenant-id": TID, "x-dev-role": "instructor" };
const TERM_ID = "dd000000-0000-0000-0000-000000000001";
const STUDENT_ID = "ee000000-0000-0000-0000-000000000001";

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ POST /results/terms/:termId/process

describe("POST /results/terms/:termId/process", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/results/terms/${TERM_ID}/process`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when role is not allowed", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/results/terms/${TERM_ID}/process`,
      headers: instructorHeaders,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when term does not exist", async () => {
    mockWithTenant.mockResolvedValueOnce({ notFound: true } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/results/terms/${TERM_ID}/process`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "term not found");
  });

  it("returns 200 with zero processed when no published marks", async () => {
    mockWithTenant.mockResolvedValueOnce({
      processed: 0,
      message: "No published marks for this term",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/results/terms/${TERM_ID}/process`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ processed: 0 });
  });

  it("returns 200 with counts on success", async () => {
    mockWithTenant.mockResolvedValueOnce({
      processed: 10,
      students: 5,
      termId: TERM_ID,
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/results/terms/${TERM_ID}/process`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.processed).toBe(10);
    expect(body.students).toBe(5);
    expect(body.termId).toBe(TERM_ID);
  });
});

// ------------------------------------------------------------------ GET /results/terms/:termId

describe("GET /results/terms/:termId", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/results/terms/${TERM_ID}`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with ranked list", async () => {
    const fakeGpa = [
      {
        student_id: STUDENT_ID,
        gpa: 3.75,
        total_credits: 4,
        rank: 1,
        first_name: "Jane",
        last_name: "Doe",
        admission_number: "ADM-2026-0001",
      },
    ];
    mockWithTenant.mockResolvedValueOnce(fakeGpa as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/results/terms/${TERM_ID}`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ gpa: 3.75, rank: 1 });
  });
});

// ------------------------------------------------------------------ GET /results/students/:studentId/terms/:termId

describe("GET /results/students/:studentId/terms/:termId", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/results/students/${STUDENT_ID}/terms/${TERM_ID}`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with student results for term", async () => {
    const fakeResult = {
      studentId: STUDENT_ID,
      termId: TERM_ID,
      courses: [
        {
          course_id: "CS101",
          score: 85,
          grade: "A",
          grade_point: 5,
        },
      ],
      summary: { gpa: 5.0, total_credits: 1, rank: 1 },
    };
    mockWithTenant.mockResolvedValueOnce(fakeResult as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/results/students/${STUDENT_ID}/terms/${TERM_ID}`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.courses).toHaveLength(1);
    expect(body.summary).toMatchObject({ gpa: 5.0, rank: 1 });
  });
});
