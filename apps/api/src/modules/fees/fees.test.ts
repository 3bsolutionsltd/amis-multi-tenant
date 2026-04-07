import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000030";
const STUDENT_ID = "ab000000-0000-0000-0000-000000000001";

const registrarHeaders = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const financeHeaders = { "x-tenant-id": TID, "x-dev-role": "finance" };
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const hodHeaders = { "x-tenant-id": TID, "x-dev-role": "hod" };
const instructorHeaders = { "x-tenant-id": TID, "x-dev-role": "instructor" };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const fakePayment = {
  id: "cc000000-0000-0000-0000-000000000001",
  tenant_id: TID,
  student_id: STUDENT_ID,
  amount: "5000",
  currency: "ZAR",
  reference: "REF-001",
  paid_at: "2026-01-15T00:00:00.000Z",
  source: "manual",
  imported_by: null,
  created_at: new Date().toISOString(),
};

const validEntryBody = {
  student_id: STUDENT_ID,
  amount: 5000,
  currency: "ZAR",
  reference: "REF-001",
  paid_at: "2026-01-15T00:00:00.000Z",
};

const validImportBody = {
  rows: [
    {
      studentId: STUDENT_ID,
      amount: 5000,
      reference: "REF-001",
      paid_at: "2026-01-15T00:00:00.000Z",
    },
    {
      studentId: "ab000000-0000-0000-0000-000000000002",
      amount: 3000,
      reference: "REF-002",
      paid_at: "2026-02-01T00:00:00.000Z",
    },
  ],
};

// ------------------------------------------------------------------ GET /fees/students/:studentId/summary

describe("GET /fees/students/:studentId/summary", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fees/students/${STUDENT_ID}/summary`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is instructor", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fees/students/${STUDENT_ID}/summary`,
      headers: instructorHeaders,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 with badge=OWING when no payments exist", async () => {
    mockWithTenant.mockResolvedValueOnce({
      totalPaid: 0,
      totalDue: 15000,
      balance: 15000,
      lastPayment: null,
      badge: "OWING",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fees/students/${STUDENT_ID}/summary`,
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      badge: "OWING",
      totalPaid: 0,
      balance: 15000,
    });
  });

  it("returns 200 with badge=PARTIAL when partially paid", async () => {
    mockWithTenant.mockResolvedValueOnce({
      totalPaid: 5000,
      totalDue: 15000,
      balance: 10000,
      lastPayment: "2026-01-15T00:00:00.000Z",
      badge: "PARTIAL",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fees/students/${STUDENT_ID}/summary`,
      headers: financeHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      badge: "PARTIAL",
      totalPaid: 5000,
      balance: 10000,
    });
  });

  it("returns 200 with badge=PAID when fully paid", async () => {
    mockWithTenant.mockResolvedValueOnce({
      totalPaid: 15000,
      totalDue: 15000,
      balance: 0,
      lastPayment: "2026-03-01T00:00:00.000Z",
      badge: "PAID",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fees/students/${STUDENT_ID}/summary`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ badge: "PAID", balance: 0 });
  });
});

// ------------------------------------------------------------------ GET /fees/students/:studentId/transactions

describe("GET /fees/students/:studentId/transactions", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fees/students/${STUDENT_ID}/transactions`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is hod", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fees/students/${STUDENT_ID}/transactions`,
      headers: hodHeaders,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 with transaction list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakePayment] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fees/students/${STUDENT_ID}/transactions`,
      headers: financeHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ rows: [{ reference: "REF-001" }] });
  });

  it("returns 200 with empty list when no payments", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/fees/students/${STUDENT_ID}/transactions`,
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ rows: [] });
  });
});

// ------------------------------------------------------------------ POST /fees/entry

describe("POST /fees/entry", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fees/entry",
      payload: validEntryBody,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is registrar", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fees/entry",
      headers: registrarHeaders,
      payload: validEntryBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fees/entry",
      headers: financeHeaders,
      payload: { student_id: STUDENT_ID }, // missing amount, reference, paid_at
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 201 with payment on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ payment: fakePayment } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fees/entry",
      headers: financeHeaders,
      payload: validEntryBody,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ payment: { reference: "REF-001" } });
  });
});

// ------------------------------------------------------------------ POST /fees/import

describe("POST /fees/import", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fees/import",
      payload: validImportBody,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is registrar", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fees/import",
      headers: registrarHeaders,
      payload: validImportBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when rows array is empty", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fees/import",
      headers: financeHeaders,
      payload: { rows: [] }, // min(1) violated
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 200 with inserted count on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ inserted: 2, errors: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/fees/import",
      headers: financeHeaders,
      payload: validImportBody,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ inserted: 2, errors: [] });
  });
});

// ------------------------------------------------------------------ POST /webhooks/schoolpay

describe("POST /webhooks/schoolpay", () => {
  it("returns 501 Not Implemented", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/schoolpay",
      payload: {},
    });
    expect(res.statusCode).toBe(501);
  });
});
