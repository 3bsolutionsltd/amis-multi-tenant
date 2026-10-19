import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));
vi.mock("../../db/pool.js", () => ({
  pool: { query: vi.fn() },
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000099";
const STUDENT_ID = "aa000000-0000-0000-0000-000000000001";
const TERM_ID = "bb000000-0000-0000-0000-000000000001";

const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const financeHeaders = { "x-tenant-id": TID, "x-dev-role": "finance" };
const hodHeaders = { "x-tenant-id": TID, "x-dev-role": "hod" };

beforeEach(() => vi.resetAllMocks());

// ── Eligibility ────────────────────────────────────────────────────────────

describe("GET /clearance/eligibility/:studentId", () => {
  it("returns 400 when x-tenant-id is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/clearance/eligibility/${STUDENT_ID}?term_id=${TERM_ID}`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 422 when term_id query param is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/clearance/eligibility/${STUDENT_ID}`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toHaveProperty("error", "term_id query parameter required");
  });

  it("returns 404 when student not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ notFound: true } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/clearance/eligibility/${STUDENT_ID}?term_id=${TERM_ID}`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "student not found");
  });

  it("returns 404 when term not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ termNotFound: true } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/clearance/eligibility/${STUDENT_ID}?term_id=${TERM_ID}`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "term not found");
  });

  it("returns 200 with fully eligible student", async () => {
    const eligibility = {
      student_id: STUDENT_ID,
      term_id: TERM_ID,
      checks: {
        registered: { pass: true, detail: "Registered for Term 1 2025/2026" },
        fees_cleared: { pass: true, detail: "Paid UGX 1,200,000 of UGX 1,200,000 due" },
        marks_complete: { pass: true, detail: "3 course mark entries found" },
      },
      eligible: true,
    };
    mockWithTenant.mockResolvedValueOnce(eligibility as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/clearance/eligibility/${STUDENT_ID}?term_id=${TERM_ID}`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ eligible: true });
    expect(res.json().checks.registered.pass).toBe(true);
    expect(res.json().checks.fees_cleared.pass).toBe(true);
    expect(res.json().checks.marks_complete.pass).toBe(true);
  });

  it("returns 200 with eligible=false when fees not cleared", async () => {
    const eligibility = {
      student_id: STUDENT_ID,
      term_id: TERM_ID,
      checks: {
        registered: { pass: true, detail: "Registered for Term 1 2025/2026" },
        fees_cleared: { pass: false, detail: "Paid UGX 0 of UGX 1,200,000 due" },
        marks_complete: { pass: true, detail: "3 course mark entries found" },
      },
      eligible: false,
    };
    mockWithTenant.mockResolvedValueOnce(eligibility as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/clearance/eligibility/${STUDENT_ID}?term_id=${TERM_ID}`,
      headers: financeHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ eligible: false });
    expect(res.json().checks.fees_cleared.pass).toBe(false);
  });

  it("uses Government tuition, ignores residence tuition, and applies the tenant fee policy", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{
          id: STUDENT_ID,
          programme_id: "cc000000-0000-0000-0000-000000000001",
          programme: "Diploma in ICT",
          programme_code: "DICT",
          sponsorship_type: "Government",
          residence_category: "boarding",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ payload: { fees: { governmentOtherFeeTypes: ["functional"] } } }],
      })
      .mockResolvedValueOnce({
        rows: [{
          term_name: "Term 1",
          term_number: 1,
          academic_year_id: "dd000000-0000-0000-0000-000000000001",
          academic_year_name: "2025/2026",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            fee_type: "tuition",
            student_category: "government",
            term_id: TERM_ID,
            amount: "300000",
          },
          {
            fee_type: "tuition",
            student_category: "boarding",
            term_id: TERM_ID,
            amount: "704000",
          },
          {
            fee_type: "functional",
            student_category: "all",
            term_id: TERM_ID,
            amount: "15000",
          },
          {
            fee_type: "examination",
            student_category: "all",
            term_id: TERM_ID,
            amount: "5000",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: "0" }] })
      .mockResolvedValueOnce({ rows: [{ cnt: "0" }] })
      .mockResolvedValueOnce({ rows: [{ attended: "0", total: "0" }] });

    mockWithTenant.mockImplementationOnce(async (_tid, callback) =>
      callback({ query } as never),
    );

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/clearance/eligibility/${STUDENT_ID}?term_id=${TERM_ID}`,
      headers: financeHeaders,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().checks.fees_cleared.pass).toBe(false);
    expect(res.json().checks.fees_cleared.detail).toContain("of UGX 315,000 due");
    const feeQuery = query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM app.fee_structures fs"),
    );
    expect(feeQuery).toBeDefined();
    if (!feeQuery) throw new Error("Fee structure query was not executed");
    expect(feeQuery[0]).toContain("LOWER(fs.student_category) = ANY($3::text[])");
    expect(feeQuery[1]?.[2]).toEqual(["all", "government"]);
  });
});

// ── Sign-off enforcement ───────────────────────────────────────────────────

describe("POST /clearance/sign-off — eligibility enforcement", () => {
  it("returns 422 when Finance signs off accounts with unpaid fees", async () => {
    mockWithTenant.mockResolvedValueOnce({
      eligibilityFailed: true,
      message: "Finance clearance blocked: Paid UGX 0 of UGX 1,200,000 due",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/clearance/sign-off",
      headers: financeHeaders,
      payload: {
        student_id: STUDENT_ID,
        term_id: TERM_ID,
        department: "accounts",
        status: "SIGNED",
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toContain("Finance clearance blocked");
  });

  it("returns 422 when HOD signs off with no mark entries", async () => {
    mockWithTenant.mockResolvedValueOnce({
      eligibilityFailed: true,
      message: "HOD clearance blocked: No mark entries found for this term",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/clearance/sign-off",
      headers: hodHeaders,
      payload: {
        student_id: STUDENT_ID,
        term_id: TERM_ID,
        department: "hod",
        status: "SIGNED",
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toContain("HOD clearance blocked");
  });

  it("allows REJECTED status for accounts even with unpaid fees", async () => {
    const fakeSignOff = {
      id: "cc000000-0000-0000-0000-000000000001",
      student_id: STUDENT_ID,
      term_id: TERM_ID,
      department: "accounts",
      status: "REJECTED",
      signed_by: null,
      signed_at: new Date().toISOString(),
      remarks: "Unpaid fees",
    };
    mockWithTenant.mockResolvedValueOnce(fakeSignOff as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/clearance/sign-off",
      headers: financeHeaders,
      payload: {
        student_id: STUDENT_ID,
        term_id: TERM_ID,
        department: "accounts",
        status: "REJECTED",
        remarks: "Unpaid fees",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ department: "accounts", status: "REJECTED" });
  });

  it("returns 404 when student not found", async () => {
    mockWithTenant.mockResolvedValueOnce({
      notFound: true,
      message: "student not found",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/clearance/sign-off",
      headers: adminHeaders,
      payload: {
        student_id: STUDENT_ID,
        term_id: TERM_ID,
        department: "store",
        status: "SIGNED",
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 422 with validation error for invalid department", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/clearance/sign-off",
      headers: adminHeaders,
      payload: {
        student_id: STUDENT_ID,
        term_id: TERM_ID,
        department: "invalid_dept",
        status: "SIGNED",
      },
    });
    expect(res.statusCode).toBe(422);
  });
});
