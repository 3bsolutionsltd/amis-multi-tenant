import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";

const mockWithTenant = vi.mocked(withTenant);
const TID = "00000000-0000-0000-0000-000000000041";
const SRQ_ID = "ee000000-0000-0000-0000-000000000001";
const headers = { "x-tenant-id": TID, "x-dev-role": "admin" };

beforeEach(() => vi.resetAllMocks());

describe("GET /stores/requisitions/:id", () => {
  it("qualifies item columns joined with inventory columns", async () => {
    const requisition = {
      id: SRQ_ID,
      srq_number: "SRQ-2026-001",
      requested_by: "Finance",
      department: null,
      purpose: null,
      required_date: null,
      student_project_id: null,
      course_id: null,
      term_id: null,
      status: "draft",
      hod_approved_by: null,
      hod_approved_at: null,
      rejection_reason: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const item = {
      id: "ff000000-0000-0000-0000-000000000001",
      srq_id: SRQ_ID,
      item_id: "aa000000-0000-0000-0000-000000000001",
      description: "Paper",
      quantity_requested: "10",
      quantity_approved: null,
      unit: "reams",
      unit_cost: null,
      notes: null,
      created_at: new Date().toISOString(),
      item_name: "Paper",
      unit_of_measure: "reams",
      current_stock: "100",
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [requisition] })
      .mockResolvedValueOnce({ rows: [item] })
      .mockResolvedValueOnce({ rows: [] });
    mockWithTenant.mockImplementationOnce(async (_tid, callback) =>
      callback({ query } as never),
    );

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/stores/requisitions/${SRQ_ID}`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().items).toMatchObject([{ id: item.id, description: "Paper" }]);
    const itemQuery = String(query.mock.calls[1]?.[0]);
    expect(itemQuery).toContain("sri.id");
    expect(itemQuery).toContain("sri.description");
    expect(itemQuery).toContain("inv.name AS item_name");
  });
});
