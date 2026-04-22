import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000043";
const financeHeaders = { "x-tenant-id": TID, "x-dev-role": "finance" };
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const instructorHeaders = { "x-tenant-id": TID, "x-dev-role": "instructor" };
const registrarHeaders = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const headers = { "x-tenant-id": TID };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const AY_ID = "aa000000-0000-0000-0000-000000000001";
const TERM_ID = "bb000000-0000-0000-0000-000000000001";
const PROG_ID = "cc000000-0000-0000-0000-000000000001";

const fakeFeeStructure = {
  id: "dd000000-0000-0000-0000-000000000001",
  tenant_id: TID,
  academic_year_id: AY_ID,
  term_id: null,
  programme_id: PROG_ID,
  fee_type: "tuition",
  description: "Tuition for NCBC",
  amount: 1500000,
  currency: "UGX",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ================================================================== Fee Structures

describe("POST /fee-structures", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fee-structures",
      payload: {
        academic_year_id: AY_ID,
        programme_id: PROG_ID,
        amount: 1500000,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for instructor role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fee-structures",
      headers: instructorHeaders,
      payload: {
        academic_year_id: AY_ID,
        programme_id: PROG_ID,
        amount: 1500000,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 for registrar role (finance-only write)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fee-structures",
      headers: registrarHeaders,
      payload: {
        academic_year_id: AY_ID,
        programme_id: PROG_ID,
        amount: 1500000,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fee-structures",
      headers: financeHeaders,
      payload: { amount: -100 },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 201 on success with finance role", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeFeeStructure] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fee-structures",
      headers: financeHeaders,
      payload: {
        academic_year_id: AY_ID,
        programme_id: PROG_ID,
        amount: 1500000,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ amount: 1500000, fee_type: "tuition" });
  });

  it("returns 201 on success with admin role", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeFeeStructure] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fee-structures",
      headers: adminHeaders,
      payload: {
        academic_year_id: AY_ID,
        programme_id: PROG_ID,
        amount: 1500000,
        fee_type: "functional",
      },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe("GET /fee-structures", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/fee-structures" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeFeeStructure] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/fee-structures",
      headers: financeHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 200 filtered by academic_year_id", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeFeeStructure] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fee-structures?academic_year_id=${AY_ID}`,
      headers: financeHeaders,
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 200 for registrar role (read allowed)", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/fee-structures",
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 for instructor role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/fee-structures",
      headers: instructorHeaders,
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /fee-structures/:id", () => {
  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fee-structures/${fakeFeeStructure.id}`,
      headers: financeHeaders,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeFeeStructure] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fee-structures/${fakeFeeStructure.id}`,
      headers: financeHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ amount: 1500000 });
  });
});

describe("PATCH /fee-structures/:id", () => {
  it("returns 422 when no fields provided", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/fee-structures/${fakeFeeStructure.id}`,
      headers: financeHeaders,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/fee-structures/${fakeFeeStructure.id}`,
      headers: financeHeaders,
      payload: { amount: 2000000 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ ...fakeFeeStructure, amount: 2000000 }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/fee-structures/${fakeFeeStructure.id}`,
      headers: financeHeaders,
      payload: { amount: 2000000 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().amount).toBe(2000000);
  });
});
