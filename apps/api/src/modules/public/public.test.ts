import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

vi.mock("../../db/pool.js", () => ({
  pool: { query: vi.fn() },
}));

vi.mock("../../lib/workflowDef.js", () => ({
  loadWorkflowDef: vi.fn(),
}));

vi.mock("../../lib/email.js", () => ({
  buildApplicationReceivedEmail: vi.fn(() => ({
    html: "application receipt",
    text: "application receipt",
  })),
  sendMail: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
import { pool } from "../../db/pool.js";
import { buildApplicationReceivedEmail, sendMail } from "../../lib/email.js";
import { loadWorkflowDef } from "../../lib/workflowDef.js";

const mockWithTenant = vi.mocked(withTenant);
const mockPoolQuery = vi.mocked(pool.query);
const mockBuildApplicationReceivedEmail = vi.mocked(buildApplicationReceivedEmail);
const mockLoadWorkflowDef = vi.mocked(loadWorkflowDef);
const mockSendMail = vi.mocked(sendMail);

const TID = "00000000-0000-0000-0000-000000000099";
const APP_ID = "aa000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
  mockBuildApplicationReceivedEmail.mockReturnValue({
    html: "application receipt",
    text: "application receipt",
  });
  mockSendMail.mockResolvedValue();
  mockLoadWorkflowDef.mockResolvedValue({
    key: "admissions",
    initial_state: "ADMITTED",
    states: ["ADMITTED", "REPORTED"],
    transitions: [],
  });
});

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

describe("GET /public/:tenantSlug/info", () => {
  it("returns the institution name and published branding", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{
        name: "Demo VTI",
        slug: "demo-vti",
        branding_json: JSON.stringify({ appName: "Demo Technical Institute", logoUrl: "https://example.test/logo.png" }),
        theme_json: JSON.stringify({ primaryColor: "#0f766e" }),
      }],
    } as never);
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/public/demo-vti/info" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      name: "Demo Technical Institute",
      slug: "demo-vti",
      logoUrl: "https://example.test/logo.png",
      primaryColor: "#0f766e",
    });
  });
});

// ------------------------------------------------------------------ POST /public/:tenantSlug/apply

describe("GET /public/:tenantSlug/programmes", () => {
  it("returns 404 if tenant slug not found", async () => {
    stubSlugLookup(false);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/public/unknown-school/programmes",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/institution/i);
  });

  it("returns active programmes for the tenant", async () => {
    stubSlugLookup(true);
    const programmes = [{
      id: "11111111-1111-1111-1111-111111111111",
      code: "DICT",
      title: "Diploma in ICT",
      department: null,
      duration_months: null,
      level: null,
    }];
    mockWithTenant.mockImplementationOnce(async (_tid, cb) => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: programmes }) };
      return cb(mockClient as never);
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/public/demo-school/programmes",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(programmes);
  });
});

// ------------------------------------------------------------------ POST /public/:tenantSlug/apply

describe("POST /public/:tenantSlug/apply", () => {
  const validBody = {
    first_name: "Jane",
    last_name: "Doe",
    programme: "DICT",
    intake: "2026-Sept",
    email: "jane@example.com",
    sponsorship_type: "Day Scholar",
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
    const programme = {
      id: "11111111-1111-1111-1111-111111111111",
      code: "DICT",
      title: "Diploma in ICT",
    };
    const fakeApp = {
      id: APP_ID,
      first_name: "Jane",
      last_name: "Doe",
      programme: "DICT",
      intake: "2026-Sept",
      created_at: new Date().toISOString(),
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [programme] })
      .mockResolvedValueOnce({ rows: [fakeApp] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockWithTenant.mockImplementation(async (_tid, cb) => {
      const mockClient = {
        query,
      };
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
    expect(body.application.programme).toBe("DICT");
    expect(body.workflowState).toBe("ADMITTED");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO app.workflow_instances"),
      [TID, APP_ID, "ADMITTED"],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO app.workflow_events"),
      [TID, APP_ID, "ADMITTED"],
    );
    expect(mockBuildApplicationReceivedEmail).toHaveBeenCalledWith(
      "Jane",
      APP_ID,
      "DICT",
      "2026-Sept",
    );
    expect(mockSendMail).toHaveBeenCalledWith({
      to: "jane@example.com",
      subject: "Application Received — AMIS",
      html: "application receipt",
      text: "application receipt",
    });
  });

  it("does not send a receipt when no email address was provided", async () => {
    stubSlugLookup(true);
    const programme = {
      id: "11111111-1111-1111-1111-111111111111",
      code: "DICT",
      title: "Diploma in ICT",
    };
    const fakeApp = {
      id: APP_ID,
      first_name: "Jane",
      last_name: "Doe",
      programme: "DICT",
      intake: "2026-Sept",
      created_at: new Date().toISOString(),
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [programme] })
      .mockResolvedValueOnce({ rows: [fakeApp] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockWithTenant.mockImplementation(async (_tid, cb) => {
      return cb({ query } as never);
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/public/demo-school/apply",
      payload: { ...validBody, email: undefined },
    });

    expect(res.statusCode).toBe(201);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns 422 when admissions workflow is unavailable", async () => {
    stubSlugLookup(true);
    mockLoadWorkflowDef.mockResolvedValueOnce(null);
    mockWithTenant.mockImplementationOnce(async (_tid, cb) => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{
            id: "11111111-1111-1111-1111-111111111111",
            code: "DICT",
            title: "Diploma in ICT",
          }],
        }),
      };
      return cb(mockClient as never);
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/public/demo-school/apply",
      payload: validBody,
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatch(/workflow "admissions"/);
  });

  it("returns 422 when programme code does not exist", async () => {
    stubSlugLookup(true);
    mockWithTenant.mockImplementationOnce(async (_tid, cb) => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };
      return cb(mockClient as never);
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/public/demo-school/apply",
      payload: { ...validBody, programme: "DCIT" },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: "programme not found" });
  });

  it("inserts source='online' for public portal submissions", async () => {
    // Regression for issue #176 — the INSERT must include source='online'
    // so online applications are distinguishable from staff-created ones.
    stubSlugLookup(true);
    let insertedOnlineSource = false;
    mockWithTenant.mockImplementation(async (_tid, cb) => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("FROM app.programmes")) {
            return Promise.resolve({
              rows: [{
                id: "11111111-1111-1111-1111-111111111111",
                code: "DICT",
                title: "Diploma in ICT",
              }],
            });
          }
          if (sql.includes("'online'")) insertedOnlineSource = true;
          return Promise.resolve({
            rows: [{
              id: APP_ID,
              first_name: "Jane",
              last_name: "Doe",
              programme: "DICT",
              intake: "2026-Sept",
              created_at: new Date().toISOString(),
            }],
          });
        }),
      };
      return cb(mockClient as never);
    });

    const app = buildApp();
    await app.inject({
      method: "POST",
      url: "/public/demo-school/apply",
      payload: validBody,
    });
    expect(insertedOnlineSource).toBe(true);
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
