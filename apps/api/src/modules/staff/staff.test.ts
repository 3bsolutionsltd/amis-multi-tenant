import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TENANT = "ab000000-0000-0000-0000-000000000001";

const STAFF = {
  id: "ab000000-0000-0000-0000-000000000020",
  staff_number: "STF001",
  first_name: "Jane",
  last_name: "Ndlovu",
  email: "jane.ndlovu@greenfield.ac.za",
  phone: "0821234567",
  department: "ICT",
  designation: "Lecturer",
  employment_type: "full_time",
  join_date: "2022-01-10",
  salary: 35000,
  is_active: true,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const CONTRACT = {
  id: "ab000000-0000-0000-0000-000000000021",
  staff_id: STAFF.id,
  contract_type: "permanent",
  start_date: "2022-01-10",
  end_date: null,
  salary: 35000,
  notes: null,
  created_at: new Date().toISOString(),
};

const ATTENDANCE = {
  id: "ab000000-0000-0000-0000-000000000022",
  staff_id: STAFF.id,
  attendance_date: "2026-04-15",
  session: "full",
  status: "present",
  notes: null,
  created_at: new Date().toISOString(),
};

const APPRAISAL = {
  id: "ab000000-0000-0000-0000-000000000023",
  staff_id: STAFF.id,
  period: "2025-Q4",
  rating: 4,
  comments: "Excellent performance",
  appraised_by: "Principal",
  appraised_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

// ============================================================ GET /staff
describe("GET /staff", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/staff" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns staff list from the DB", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [STAFF] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/staff",
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([STAFF]);
  });

  it("returns 403 for disallowed role (student)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/staff",
      headers: { "x-tenant-id": TENANT, "x-dev-role": "student" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ============================================================ GET /staff/:id
describe("GET /staff/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when staff not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/staff/${STAFF.id}`,
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns a staff profile by id", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [STAFF] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/staff/${STAFF.id}`,
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(STAFF);
  });
});

// ============================================================ POST /staff
describe("POST /staff", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a staff profile and returns 201", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [STAFF] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/staff",
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: {
        first_name: "Jane",
        last_name: "Ndlovu",
        department: "ICT",
        designation: "Lecturer",
        employment_type: "full_time",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(STAFF);
  });

  it("returns 422 on missing required fields", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/staff",
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 403 for instructor (not in HR_ROLES)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/staff",
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "instructor",
        "content-type": "application/json",
      },
      payload: { first_name: "Jane", last_name: "Ndlovu" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ============================================================ PATCH /staff/:id
describe("PATCH /staff/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates a staff profile", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ ...STAFF, designation: "Senior Lecturer" }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/staff/${STAFF.id}`,
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: { designation: "Senior Lecturer" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().designation).toBe("Senior Lecturer");
  });

  it("returns 404 when staff not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/staff/${STAFF.id}`,
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: { designation: "Senior Lecturer" },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ============================================================ DELETE /staff/:id
describe("DELETE /staff/:id", () => {
  beforeEach(() => vi.resetAllMocks());

  it("soft-deletes and returns 204", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ id: STAFF.id }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/staff/${STAFF.id}`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 403 for non-admin roles", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/staff/${STAFF.id}`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "registrar" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ============================================================ GET /staff/:id/contracts
describe("GET /staff/:id/contracts", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns contract list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [CONTRACT] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/staff/${STAFF.id}/contracts`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([CONTRACT]);
  });

  it("returns 403 for instructor (not in HR_ROLES)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/staff/${STAFF.id}/contracts`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "instructor" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ============================================================ POST /staff/:id/contracts
describe("POST /staff/:id/contracts", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a contract and returns 201", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [CONTRACT] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/staff/${STAFF.id}/contracts`,
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: { contract_type: "permanent", start_date: "2022-01-10" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(CONTRACT);
  });

  it("returns 422 when contract_type is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/staff/${STAFF.id}/contracts`,
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: { start_date: "2022-01-10" },
    });
    expect(res.statusCode).toBe(422);
  });
});

// ============================================================ GET /staff/:id/attendance
describe("GET /staff/:id/attendance", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns attendance list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [ATTENDANCE] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/staff/${STAFF.id}/attendance`,
      headers: { "x-tenant-id": TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([ATTENDANCE]);
  });
});

// ============================================================ POST /staff/:id/attendance
describe("POST /staff/:id/attendance", () => {
  beforeEach(() => vi.resetAllMocks());

  it("records attendance and returns 201", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [ATTENDANCE] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/staff/${STAFF.id}/attendance`,
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: { attendance_date: "2026-04-15", session: "full", status: "present" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(ATTENDANCE);
  });

  it("returns 422 when attendance_date is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/staff/${STAFF.id}/attendance`,
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: { session: "full", status: "present" },
    });
    expect(res.statusCode).toBe(422);
  });
});

// ============================================================ GET /staff/:id/appraisals
describe("GET /staff/:id/appraisals", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns appraisal list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [APPRAISAL] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/staff/${STAFF.id}/appraisals`,
      headers: { "x-tenant-id": TENANT, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([APPRAISAL]);
  });
});

// ============================================================ POST /staff/:id/appraisals
describe("POST /staff/:id/appraisals", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates an appraisal and returns 201", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [APPRAISAL] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/staff/${STAFF.id}/appraisals`,
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: { period: "2025-Q4", rating: 4, comments: "Excellent performance" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(APPRAISAL);
  });

  it("returns 422 when period is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/staff/${STAFF.id}/appraisals`,
      headers: {
        "x-tenant-id": TENANT,
        "x-dev-role": "admin",
        "content-type": "application/json",
      },
      payload: { rating: 4 },
    });
    expect(res.statusCode).toBe(422);
  });
});
