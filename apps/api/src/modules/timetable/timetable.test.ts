import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";

const mockWithTenant = vi.mocked(withTenant);
const TID = "00000000-0000-0000-0000-000000000041";
const COURSE_ID = "dd000000-0000-0000-0000-000000000001";
const headers = { "x-tenant-id": TID, "x-dev-role": "admin" };

beforeEach(() => vi.resetAllMocks());

describe("POST /timetable", () => {
  it("creates a slot and returns unqualified table columns", async () => {
    const slot = {
      id: "ee000000-0000-0000-0000-000000000001",
      programme: "NCBC",
      academic_year: "2025/2026",
      term_number: 1,
      day_of_week: "Monday",
      start_time: "08:00:00",
      end_time: "09:00:00",
      course_id: COURSE_ID,
      room: null,
      instructor_name: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const query = vi.fn().mockResolvedValue({ rows: [slot] });
    mockWithTenant.mockImplementationOnce(async (_tid, callback) =>
      callback({ query } as never),
    );

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/timetable",
      headers,
      payload: {
        programme: "NCBC",
        academic_year: "2025/2026",
        term_number: 1,
        day_of_week: "Monday",
        start_time: "08:00",
        end_time: "09:00",
        course_id: COURSE_ID,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ programme: "NCBC", course_id: COURSE_ID });
    const insertSql = String(query.mock.calls[0]?.[0]);
    expect(insertSql).toMatch(/RETURNING\s+id,\s*programme,\s*academic_year/);
    expect(insertSql).not.toContain("RETURNING s.");
    expect(query.mock.calls[0]?.[1]).toContain(TID);
  });
});
