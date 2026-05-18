import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

// Mock DB pool so tests don't need a real Postgres connection
vi.mock("../../db/pool.js", () => ({
  pool: { query: vi.fn() },
  superPool: { query: vi.fn() },
}));

// Mock queue — tests run without Redis
vi.mock("../../lib/queue.js", () => ({
  getOutboxQueue: vi.fn(),
  startOutboxWorker: vi.fn(),
  stopOutboxWorker: vi.fn(),
}));

import { superPool } from "../../db/pool.js";
import { getOutboxQueue } from "../../lib/queue.js";

const mockSuperPool = vi.mocked(superPool);
const mockGetQueue = vi.mocked(getOutboxQueue);

const ADMIN_HEADERS = {
  "x-dev-role": "admin",
  "x-tenant-id": "00000000-0000-0000-0000-000000000001",
};
const INSTRUCTOR_HEADERS = {
  "x-dev-role": "instructor",
  "x-tenant-id": "00000000-0000-0000-0000-000000000001",
};

beforeEach(() => vi.resetAllMocks());

// ---------------------------------------------------------------------------
describe("GET /sync/status", () => {
  // Note: in test/dev mode devIdentityHook defaults to role='admin' when no
  // x-dev-role header is sent, so 401 is not triggerable without a real JWT.
  // We instead verify that non-admin roles are blocked (403).

  it("returns 403 when role is not admin", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/sync/status",
      headers: INSTRUCTOR_HEADERS,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 with queueDepth and workerActive=false when Redis is down (#104)", async () => {
    // Mock DB returning depth=3 and no last_processed
    (mockSuperPool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [{ depth: "3" }] })
      .mockResolvedValueOnce({ rows: [{ last_processed: null }] });
    mockGetQueue.mockReturnValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/sync/status",
      headers: ADMIN_HEADERS,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.queueDepth).toBe(3);
    expect(body.lastProcessedAt).toBeNull();
    expect(body.workerActive).toBe(false);
  });

  it("returns 200 with workerActive=true when Redis queue is active (#104)", async () => {
    (mockSuperPool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [{ depth: "0" }] })
      .mockResolvedValueOnce({ rows: [{ last_processed: "2026-05-11T12:00:00Z" }] });
    // Return a non-null mock queue to simulate active Redis
    mockGetQueue.mockReturnValue({} as ReturnType<typeof getOutboxQueue>);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/sync/status",
      headers: ADMIN_HEADERS,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.queueDepth).toBe(0);
    expect(body.lastProcessedAt).toBe("2026-05-11T12:00:00Z");
    expect(body.workerActive).toBe(true);
  });

  it("returns 200 with correct queueDepth when there are unprocessed events (#104)", async () => {
    (mockSuperPool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [{ depth: "42" }] })
      .mockResolvedValueOnce({ rows: [{ last_processed: "2026-05-10T08:00:00Z" }] });
    mockGetQueue.mockReturnValue({} as ReturnType<typeof getOutboxQueue>);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/sync/status",
      headers: ADMIN_HEADERS,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().queueDepth).toBe(42);
  });
});
