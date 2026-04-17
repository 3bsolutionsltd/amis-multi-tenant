import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "ee000000-0000-0000-0000-000000000001";
const adminH = { "x-tenant-id": TID, "x-dev-role": "admin" };
const registrarH = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const hodH = { "x-tenant-id": TID, "x-dev-role": "hod" };
const principalH = { "x-tenant-id": TID, "x-dev-role": "principal" };
const instructorH = { "x-tenant-id": TID, "x-dev-role": "instructor" };

const ANALYTICS_RESULT = {
  students: { total_active: 42 },
  term_registrations: { total: 30, filters: { academic_year: null, term: null } },
  admissions_by_state: [{ state: "submitted", count: 10 }],
  marks_by_state: [{ state: "DRAFT", count: 5 }],
  students_by_programme: [{ code: "NCBC", title: "Biz Computing", student_count: 15 }],
  industrial_training_by_status: [{ status: "active", count: 8 }],
  field_placements_by_status: [{ status: "active", count: 6 }],
  fees_summary: { total_due: 5000000, total_collected: 3000000, total_outstanding: 2000000, students_with_arrears: 7 },
};

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ GET /analytics/term

describe("GET /analytics/term", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/analytics/term" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 for instructor role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/analytics/term",
      headers: instructorH,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns analytics data for admin", async () => {
    mockWithTenant.mockResolvedValueOnce(ANALYTICS_RESULT as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/analytics/term",
      headers: adminH,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("students");
    expect(body).toHaveProperty("term_registrations");
    expect(body).toHaveProperty("admissions_by_state");
    expect(body).toHaveProperty("marks_by_state");
    expect(body).toHaveProperty("students_by_programme");
    expect(body).toHaveProperty("industrial_training_by_status");
    expect(body).toHaveProperty("field_placements_by_status");
    expect(body).toHaveProperty("fees_summary");
  });

  it("returns analytics data for registrar", async () => {
    mockWithTenant.mockResolvedValueOnce(ANALYTICS_RESULT as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/analytics/term",
      headers: registrarH,
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns analytics data for hod", async () => {
    mockWithTenant.mockResolvedValueOnce(ANALYTICS_RESULT as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/analytics/term",
      headers: hodH,
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns analytics data for principal", async () => {
    mockWithTenant.mockResolvedValueOnce(ANALYTICS_RESULT as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/analytics/term",
      headers: principalH,
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts academic_year and term query filters", async () => {
    mockWithTenant.mockResolvedValueOnce({
      ...ANALYTICS_RESULT,
      term_registrations: {
        total: 5,
        filters: { academic_year: "2026", term: "1" },
      },
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/analytics/term?academic_year=2026&term=1",
      headers: adminH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().term_registrations.filters.academic_year).toBe("2026");
    expect(res.json().term_registrations.filters.term).toBe("1");
  });
});
