import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000010";
const headers = { "x-tenant-id": TID };
const registrarHeaders = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const hodHeaders = { "x-tenant-id": TID, "x-dev-role": "hod" };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const fakeApplication = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  tenant_id: TID,
  first_name: "Jane",
  last_name: "Doe",
  programme: "Computer Science",
  intake: "2026-01",
  dob: null,
  gender: "Female",
  extension: {},
  created_at: new Date().toISOString(),
  current_state: "submitted",
};

const validBody = {
  first_name: "Jane",
  last_name: "Doe",
  programme: "Computer Science",
  intake: "2026-01",
  gender: "Female",
};

// ------------------------------------------------------------------ POST /admissions/applications

describe("POST /admissions/applications", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/applications",
      payload: validBody,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is not registrar or admin", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/applications",
      headers: hodHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/applications",
      headers: registrarHeaders,
      payload: { first_name: "Jane" }, // missing required fields
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when workflow not found in published config", async () => {
    mockWithTenant.mockResolvedValueOnce({
      configError: true,
      message: 'workflow "admissions" not found in published config',
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/applications",
      headers: registrarHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatch(/admissions/);
  });

  it("returns 201 with application and workflowState on success", async () => {
    mockWithTenant.mockResolvedValueOnce({
      application: fakeApplication,
      workflowState: "submitted",
    } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/applications",
      headers: registrarHeaders,
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      application: { first_name: "Jane", last_name: "Doe" },
      workflowState: "submitted",
    });
  });
});

// ------------------------------------------------------------------ GET /admissions/applications

describe("GET /admissions/applications", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/admissions/applications",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 200 with list including current_state", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeApplication] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/admissions/applications",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([fakeApplication]);
  });

  it("returns 200 with filtered list by intake and programme", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeApplication] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/admissions/applications?intake=2026-01&programme=Computer+Science",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});

// ------------------------------------------------------------------ GET /admissions/applications/:id

describe("GET /admissions/applications/:id", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/admissions/applications/some-id",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 404 when application does not exist", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/admissions/applications/nonexistent-id",
      headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "not found");
  });

  it("returns 200 with the application and current_state", async () => {
    mockWithTenant.mockResolvedValueOnce(fakeApplication as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/admissions/applications/${fakeApplication.id}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: fakeApplication.id,
      current_state: "submitted",
    });
  });
});

// ------------------------------------------------------------------ POST /admissions/import

describe("POST /admissions/import", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/import",
      payload: { filename: "test.csv", rows: [] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is not registrar or admin", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/import",
      headers: hodHeaders,
      payload: { filename: "test.csv", rows: [] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 with preview: valid + invalid rows", async () => {
    const fakeBatch = {
      id: "batch-uuid-1",
      filename: "test.csv",
      status: "preview",
      row_count: 1,
    };
    mockWithTenant.mockResolvedValueOnce(fakeBatch as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/import",
      headers: registrarHeaders,
      payload: {
        filename: "test.csv",
        rows: [
          validBody,
          { first_name: "Bad" }, // invalid — missing required fields
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("batchId");
    expect(body.valid).toHaveLength(1);
    expect(body.invalid).toHaveLength(1);
    expect(body.total).toBe(2);
  });
});

// ------------------------------------------------------------------ POST /admissions/import/:batchId/confirm

describe("POST /admissions/import/:batchId/confirm", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/import/batch-uuid-1/confirm",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 403 when role is not registrar or admin", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/import/batch-uuid-1/confirm",
      headers: hodHeaders,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when batch does not exist", async () => {
    mockWithTenant.mockResolvedValueOnce({ notFound: true } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/import/nonexistent-batch/confirm",
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "batch not found");
  });

  it("returns 200 with imported and skipped counts on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ imported: 2, skipped: 0 } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admissions/import/batch-uuid-1/confirm",
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ imported: 2, skipped: 0 });
  });
});
