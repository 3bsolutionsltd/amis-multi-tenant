import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

import { withTenant } from "../../db/tenant.js";
const mockWithTenant = vi.mocked(withTenant);

const TID = "00000000-0000-0000-0000-000000000041";
const registrarHeaders = { "x-tenant-id": TID, "x-dev-role": "registrar" };
const adminHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };
const instructorHeaders = { "x-tenant-id": TID, "x-dev-role": "instructor" };
const headers = { "x-tenant-id": TID };

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ stub data

const PROG_ID = "cc000000-0000-0000-0000-000000000001";
const TERM_ID = "bb000000-0000-0000-0000-000000000001";

const fakeCourse = {
  id: "dd000000-0000-0000-0000-000000000001",
  tenant_id: TID,
  programme_id: PROG_ID,
  code: "BCM101",
  title: "Introduction to Business Computing",
  credit_hours: 3,
  course_type: "theory",
  year_of_study: 1,
  semester: 1,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const fakeOffering = {
  id: "ee000000-0000-0000-0000-000000000002",
  tenant_id: TID,
  course_id: fakeCourse.id,
  term_id: TERM_ID,
  instructor_id: null,
  max_enrollment: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  course_code: "BCM101",
  course_title: "Introduction to Business Computing",
  term_name: "Term 1",
};

// ================================================================== Courses

describe("POST /courses", () => {
  it("returns 400 when x-tenant-id header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/courses",
      payload: { programme_id: PROG_ID, code: "BCM101", title: "Test" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for instructor role", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/courses",
      headers: instructorHeaders,
      payload: { programme_id: PROG_ID, code: "BCM101", title: "Test" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 422 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/courses",
      headers: registrarHeaders,
      payload: { code: "BCM101" }, // missing programme_id and title
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 201 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeCourse] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/courses",
      headers: registrarHeaders,
      payload: { programme_id: PROG_ID, code: "BCM101", title: "Introduction to Business Computing" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ code: "BCM101" });
  });
});

describe("GET /courses", () => {
  it("returns 200 with list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeCourse] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/courses",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 200 filtered by programme_id", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeCourse] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/courses?programme_id=${PROG_ID}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 200 with search", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/courses?search=business",
      headers,
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /courses/:id", () => {
  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/courses/${fakeCourse.id}`,
      headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeCourse] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/courses/${fakeCourse.id}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ code: "BCM101" });
  });
});

describe("PATCH /courses/:id", () => {
  it("returns 422 when no fields provided", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/courses/${fakeCourse.id}`,
      headers: registrarHeaders,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ ...fakeCourse, title: "Updated Title" }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/courses/${fakeCourse.id}`,
      headers: registrarHeaders,
      payload: { title: "Updated Title" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Updated Title");
  });
});

describe("DELETE /courses/:id", () => {
  it("returns 404 when not found", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/courses/${fakeCourse.id}`,
      headers: registrarHeaders,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 204 on success (soft delete)", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ id: fakeCourse.id }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/courses/${fakeCourse.id}`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(204);
  });
});

// ================================================================== Course Offerings

describe("POST /course-offerings", () => {
  it("returns 422 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/course-offerings",
      headers: registrarHeaders,
      payload: { course_id: "not-uuid" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 201 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeOffering] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/course-offerings",
      headers: registrarHeaders,
      payload: { course_id: fakeCourse.id, term_id: TERM_ID },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe("GET /course-offerings", () => {
  it("returns 200 with list", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [fakeOffering] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/course-offerings",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 200 filtered by term_id", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/course-offerings?term_id=${TERM_ID}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("PATCH /course-offerings/:id", () => {
  it("returns 422 when no fields provided", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/course-offerings/${fakeOffering.id}`,
      headers: registrarHeaders,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 200 on success", async () => {
    mockWithTenant.mockResolvedValueOnce({ rows: [{ ...fakeOffering, max_enrollment: 50 }] } as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/course-offerings/${fakeOffering.id}`,
      headers: registrarHeaders,
      payload: { max_enrollment: 50 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().max_enrollment).toBe(50);
  });
});
