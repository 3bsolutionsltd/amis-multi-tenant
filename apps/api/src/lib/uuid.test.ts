import { describe, it, expect, vi } from "vitest";
import { buildApp } from "../app.js";

// Mock tenant so we never hit a real DB
vi.mock("../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

const TID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const VALID_UUID = "11111111-2222-3333-8888-444444444444";

describe("UUID param validation hook", () => {
  it("rejects a non-UUID :id with 400", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/students/not-a-uuid",
      headers: { "x-tenant-id": TID, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      message: 'Invalid UUID for param "id"',
    });
  });

  it("rejects a numeric :id with 400", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/students/12345",
      headers: { "x-tenant-id": TID, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects SQL-injection attempt in :id with 400", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/students/1%27%20OR%201%3D1--",
      headers: { "x-tenant-id": TID, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("allows a valid UUID :id through", async () => {
    const { withTenant } = await import("../db/tenant.js");
    vi.mocked(withTenant).mockResolvedValueOnce({ rows: [] } as never);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/students/${VALID_UUID}`,
      headers: { "x-tenant-id": TID, "x-dev-role": "admin" },
    });
    // Should pass validation — might be 200 or 404 depending on DB mock, but NOT 400
    expect(res.statusCode).not.toBe(400);
  });

  it("validates :studentId params (fees routes)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/fees/students/bad-id/summary",
      headers: { "x-tenant-id": TID, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('Invalid UUID for param "studentId"');
  });

  it("validates :entityId but not :entityType (workflow routes)", async () => {
    const app = buildApp();
    // entityType is "application" (not a UUID, and shouldn't be validated)
    // entityId is invalid
    const res = await app.inject({
      method: "GET",
      url: "/workflow/application/bad-entity-id",
      headers: { "x-tenant-id": TID, "x-dev-role": "admin" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('Invalid UUID for param "entityId"');
  });
});
