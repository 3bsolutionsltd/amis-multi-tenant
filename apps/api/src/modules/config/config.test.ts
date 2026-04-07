import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

// Mock the tenant transaction helper — tests don't need a real DB
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000001";
const headers = { "x-tenant-id": TID };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ helpers
function makeApp() {
  return buildApp();
}

// ------------------------------------------------------------------ POST /config/draft
describe("POST /config/draft", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/config/draft",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "x-tenant-id header required" });
  });

  it("returns 422 for invalid payload (bad hex color)", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/config/draft",
      headers,
      payload: { theme: { primaryColor: "notacolor" } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toHaveProperty("error", "invalid payload");
  });

  it("returns 201 and the saved draft on success", async () => {
    const fakeDraft = {
      id: "draft-1",
      status: "draft",
      payload: { modules: { students: true } },
      created_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce(fakeDraft as never);

    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/config/draft",
      headers,
      payload: { modules: { students: true } },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(fakeDraft);
  });
});

// ------------------------------------------------------------------ POST /config/validate
describe("POST /config/validate", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({ method: "POST", url: "/config/validate" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when no draft exists", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/config/validate",
      headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty(
      "error",
      "no draft config found for this tenant",
    );
  });

  it("returns 200 and valid:true for a valid draft", async () => {
    // First withTenant call returns the draft
    mockWithTenant.mockResolvedValueOnce({
      id: "draft-1",
      payload: { modules: { students: true } },
    } as never);
    // Second withTenant call (clear validation errors) returns void
    mockWithTenant.mockResolvedValueOnce(undefined as never);

    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/config/validate",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ valid: true, config_id: "draft-1" });
  });
});

// ------------------------------------------------------------------ POST /config/publish
describe("POST /config/publish", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({ method: "POST", url: "/config/publish" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when no draft exists", async () => {
    mockWithTenant.mockResolvedValueOnce({ notFound: true } as never);
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/config/publish",
      headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 and published config on success", async () => {
    const fakePublished = {
      id: "cfg-1",
      status: "published",
      published_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce(fakePublished as never);

    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/config/publish",
      headers,
      payload: { performed_by: "admin" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: "cfg-1", status: "published" });
  });
});

// ------------------------------------------------------------------ POST /config/rollback
describe("POST /config/rollback", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({ method: "POST", url: "/config/rollback" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when no published config exists", async () => {
    mockWithTenant.mockResolvedValueOnce({ notFound: true } as never);
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/config/rollback",
      headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 with rollback result on success", async () => {
    const fakeResult = { rolled_back: "cfg-old", restored: null };
    mockWithTenant.mockResolvedValueOnce(fakeResult as never);

    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/config/rollback",
      headers,
      payload: { performed_by: "admin" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(fakeResult);
  });
});

// ------------------------------------------------------------------ GET /config
describe("GET /config", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({ method: "GET", url: "/config" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when no config exists", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = makeApp();
    const res = await app.inject({ method: "GET", url: "/config", headers });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 with the current config", async () => {
    const fakeConfig = {
      id: "cfg-1",
      status: "published",
      payload: { modules: { students: true } },
      published_at: new Date().toISOString(),
      published_by: "admin",
      created_at: new Date().toISOString(),
    };
    mockWithTenant.mockResolvedValueOnce(fakeConfig as never);

    const app = makeApp();
    const res = await app.inject({ method: "GET", url: "/config", headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: "cfg-1", status: "published" });
  });
});

// ------------------------------------------------------------------ configPayloadSchema unit tests
import { configPayloadSchema } from "./config.schema.js";

describe("configPayloadSchema", () => {
  it("accepts a minimal empty payload", () => {
    const result = configPayloadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a full valid UI config payload", () => {
    const result = configPayloadSchema.safeParse({
      branding: {
        appName: "Greenfield VTI",
        logoUrl: "https://example.com/logo.png",
      },
      theme: { primaryColor: "#2563EB" },
      navigation: {
        admin: [{ label: "Students", route: "/students" }],
      },
      dashboards: {
        admin: [
          { type: "KPI", label: "Total Students", metricKey: "total_students" },
          { type: "ACTION", label: "Enroll Student", route: "/students/new" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid theme.primaryColor (not a hex string)", () => {
    const result = configPayloadSchema.safeParse({
      theme: { primaryColor: "blue" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid branding.logoUrl (not a URL)", () => {
    const result = configPayloadSchema.safeParse({
      branding: { appName: "AMIS", logoUrl: "not-a-valid-url" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid dashboard card type", () => {
    const result = configPayloadSchema.safeParse({
      dashboards: {
        admin: [{ type: "CHART", label: "Students" }],
      },
    });
    expect(result.success).toBe(false);
  });
});
