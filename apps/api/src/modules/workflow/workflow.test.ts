import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000001";
const ENTITY_TYPE = "admission_application";
const ENTITY_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const headers = { "x-tenant-id": TID };

const BASE_URL = `/workflow/${ENTITY_TYPE}/${ENTITY_ID}`;

function makeApp() {
  return buildApp();
}

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const fakeInstance = {
  id: "inst-1",
  tenant_id: TID,
  entity_type: ENTITY_TYPE,
  entity_id: ENTITY_ID,
  workflow_key: "admissions",
  current_state: "submitted",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const fakeEvent = {
  id: "evt-1",
  entity_type: ENTITY_TYPE,
  entity_id: ENTITY_ID,
  workflow_key: "admissions",
  from_state: null,
  to_state: "submitted",
  action_key: "__init__",
  actor_user_id: null,
  meta: {},
  created_at: new Date().toISOString(),
};

// ------------------------------------------------------------------ POST /init

describe("POST /workflow/:entityType/:entityId/init", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/init`,
      payload: { workflowKey: "admissions" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 400 when workflowKey is missing", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/init`,
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "body.workflowKey is required");
  });

  it("returns 422 when workflow key not found in published config", async () => {
    mockWithTenant.mockResolvedValueOnce({
      configError: true,
      message: 'workflow "admissions" not found in published config',
    } as never);
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/init`,
      headers,
      payload: { workflowKey: "admissions" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 409 when instance already exists", async () => {
    mockWithTenant.mockResolvedValueOnce({ alreadyExists: true } as never);
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/init`,
      headers,
      payload: { workflowKey: "admissions" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 201 with instance and first event on success", async () => {
    mockWithTenant.mockResolvedValueOnce({
      instance: fakeInstance,
      event: fakeEvent,
    } as never);
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/init`,
      headers,
      payload: { workflowKey: "admissions" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      instance: { workflow_key: "admissions", current_state: "submitted" },
      event: { action_key: "__init__", from_state: null },
    });
  });
});

// ------------------------------------------------------------------ POST /transition

describe("POST /workflow/:entityType/:entityId/transition", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/transition`,
      payload: { workflowKey: "admissions", action: "shortlist" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when action is missing", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/transition`,
      headers,
      payload: { workflowKey: "admissions" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error");
  });

  it("returns 404 when no instance exists", async () => {
    mockWithTenant.mockResolvedValueOnce({ notFound: true } as never);
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/transition`,
      headers,
      payload: { workflowKey: "admissions", action: "shortlist" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when workflowKey does not match the instance", async () => {
    mockWithTenant.mockResolvedValueOnce({
      wrongKey: true,
      message: 'instance workflow_key is "admissions", not "marks"',
    } as never);
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/transition`,
      headers,
      payload: { workflowKey: "marks", action: "submit" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/workflow_key/);
  });

  it("returns 400 for an invalid action from current state", async () => {
    mockWithTenant.mockResolvedValueOnce({
      invalidTransition: true,
      message: 'action "accept" is not valid from state "submitted"',
    } as never);
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/transition`,
      headers,
      payload: { workflowKey: "admissions", action: "accept" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/not valid from state/);
  });

  it("returns 200 with updated instance and event on valid transition", async () => {
    const updatedInstance = { ...fakeInstance, current_state: "shortlisted" };
    const transitionEvent = {
      ...fakeEvent,
      from_state: "submitted",
      to_state: "shortlisted",
      action_key: "shortlist",
    };
    mockWithTenant.mockResolvedValueOnce({
      instance: updatedInstance,
      event: transitionEvent,
    } as never);

    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: `${BASE_URL}/transition`,
      headers,
      payload: { workflowKey: "admissions", action: "shortlist" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      instance: { current_state: "shortlisted" },
      event: {
        from_state: "submitted",
        to_state: "shortlisted",
        action_key: "shortlist",
      },
    });
  });
});

// ------------------------------------------------------------------ GET /workflow/:entityType/:entityId

describe("GET /workflow/:entityType/:entityId", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({ method: "GET", url: BASE_URL });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 404 when no instance exists", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = makeApp();
    const res = await app.inject({ method: "GET", url: BASE_URL, headers });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error", "workflow instance not found");
  });

  it("returns 200 with workflowKey and currentState", async () => {
    mockWithTenant.mockResolvedValueOnce(fakeInstance as never);
    const app = makeApp();
    const res = await app.inject({ method: "GET", url: BASE_URL, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      workflowKey: "admissions",
      currentState: "submitted",
    });
  });
});

// ------------------------------------------------------------------ GET /workflows/:workflowKey

const fakeDefinition = {
  key: "admissions",
  initial_state: "submitted",
  states: ["submitted", "shortlisted", "accepted", "rejected"],
  transitions: [
    { action: "shortlist", from: "submitted", to: "shortlisted" },
    { action: "accept", from: "shortlisted", to: "accepted" },
    { action: "reject", from: "submitted", to: "rejected" },
  ],
};

describe("GET /workflows/:workflowKey", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/workflows/admissions",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 404 when workflow key not found in published config", async () => {
    mockWithTenant.mockResolvedValueOnce(null as never);
    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/workflows/admissions",
      headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/not found in published config/);
  });

  it("returns 200 with the workflow definition", async () => {
    mockWithTenant.mockResolvedValueOnce(fakeDefinition as never);
    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/workflows/admissions",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      key: "admissions",
      initial_state: "submitted",
      states: expect.arrayContaining(["submitted", "shortlisted"]),
      transitions: expect.arrayContaining([
        expect.objectContaining({ action: "shortlist", from: "submitted" }),
      ]),
    });
  });
});

describe("GET /workflow/:entityType/:entityId/history", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = makeApp();
    const res = await app.inject({ method: "GET", url: `${BASE_URL}/history` });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with event list", async () => {
    const events = [
      fakeEvent,
      {
        ...fakeEvent,
        id: "evt-2",
        from_state: "submitted",
        to_state: "shortlisted",
        action_key: "shortlist",
      },
    ];
    mockWithTenant.mockResolvedValueOnce(events as never);

    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: `${BASE_URL}/history`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
    expect(res.json()[0]).toMatchObject({ action_key: "__init__" });
    expect(res.json()[1]).toMatchObject({ action_key: "shortlist" });
  });

  it("passes workflowKey query param through", async () => {
    mockWithTenant.mockResolvedValueOnce([] as never);
    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: `${BASE_URL}/history?workflowKey=admissions`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(mockWithTenant).toHaveBeenCalledOnce();
  });
});
