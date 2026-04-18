import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

vi.mock("../../db/pool.js", () => ({
  pool: { query: vi.fn() },
}));

import { withTenant } from "../../db/tenant.js";
import { pool } from "../../db/pool.js";

const mockWithTenant = vi.mocked(withTenant);
const mockPoolQuery = vi.mocked(pool.query);

const TID = "00000000-0000-0000-0000-000000000099";
const APP_ID = "aa000000-0000-0000-0000-000000000001";

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ helpers

function stubSlugLookup(found: boolean) {
  mockPoolQuery.mockResolvedValueOnce({
    rows: found ? [{ id: TID }] : [],
    command: "SELECT",
    rowCount: found ? 1 : 0,
    oid: 0,
    fields: [],
  } as never);
}

// ------------------------------------------------------------------ POST /public/:tenantSlug/apply

describe("POST /public/:tenantSlug/apply", () => {
  const validBody = {
    first_name: "Jane",
    last_name: "Doe",
    programme: "Nursing",
    intake: "2026-Sept",
    email: "jane@example.com",
  };

  it("returns 404 if tenant slug not found", async () => {
    stubSlugLookup(false);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/public/unknown-school/apply",
      payload: validBody,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/institution/i);
  });

  it("returns 422 for invalid body", async () => {
    stubSlugLookup(true);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/public/demo-school/apply",
      payload: { first_name: "Jane" }, // missing required fields
    });
    expect(res.statusCode).toBe(422);
  });

  it("creates application and returns 201", async () => {
    stubSlugLookup(true);
    const fakeApp = {
      id: APP_ID,
      first_name: "Jane",
      last_name: "Doe",
      programme: "Nursing",
      intake: "2026-Sept",
      created_at: new Date().toISOString(),
    };
    mockWithTenant.mockImplementation(async (_tid, cb) => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [fakeApp] }) };
      return cb(mockClient as never);
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/public/demo-school/apply",
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.application.first_name).toBe("Jane");
    expect(body.application.programme).toBe("Nursing");
  });
});

// ------------------------------------------------------------------ GET /public/:tenantSlug/applications/:id/status

describe("GET /public/:tenantSlug/applications/:id/status", () => {
  it("returns 404 if tenant slug not found", async () => {
    stubSlugLookup(false);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/public/unknown-school/applications/${APP_ID}/status`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 if application not found", async () => {
    stubSlugLookup(true);
    mockWithTenant.mockImplementation(async (_tid, cb) => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };
      return cb(mockClient as never);
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/public/demo-school/applications/${APP_ID}/status`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns application status", async () => {
    stubSlugLookup(true);
    const fakeResult = {
      id: APP_ID,
      first_name: "Jane",
      last_name: "Doe",
      programme: "Nursing",
      intake: "2026-Sept",
      created_at: new Date().toISOString(),
      current_state: "under_review",
    };
    mockWithTenant.mockImplementation(async (_tid, cb) => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [fakeResult] }),
      };
      return cb(mockClient as never);
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/public/demo-school/applications/${APP_ID}/status`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.application.current_state).toBe("under_review");
  });
});
