import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/pool.js", () => ({
  pool: { query: vi.fn() },
  superPool: { query: vi.fn() },
}));

import { superPool } from "../../db/pool.js";

const mockQuery = vi.mocked(superPool.query);
const TID = "00000000-0000-0000-0000-000000000318";
const USER_ID = "ab000000-0000-0000-0000-000000000318";

beforeEach(() => vi.resetAllMocks());

describe("GET /users/:id", () => {
  it("returns all assigned roles, including the primary role", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: USER_ID,
        email: "staff@example.test",
        first_name: "Staff",
        last_name: "Member",
        role: "registrar",
        roles: ["admin", "registrar"],
        department: null,
        is_active: true,
        created_at: "2026-10-14T00:00:00.000Z",
        last_login_at: null,
      }],
    } as never);

    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/users/${USER_ID}`,
      headers: { "x-tenant-id": TID, "x-dev-role": "admin" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: USER_ID,
      role: "registrar",
      roles: ["admin", "registrar"],
    });
    expect(String(mockQuery.mock.calls[0]?.[0])).toContain("LEFT JOIN platform.user_roles");
  });
});
