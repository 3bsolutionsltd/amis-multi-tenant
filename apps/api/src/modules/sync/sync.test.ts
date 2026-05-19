import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";

// ------------------------------------------------------------------ mocks

vi.mock("../../db/pool.js", () => ({
  pool: { query: vi.fn() },
  superPool: { query: vi.fn(), connect: vi.fn() },
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
const mockConnect = vi.mocked(superPool.connect);
const mockGetQueue = vi.mocked(getOutboxQueue);

// ------------------------------------------------------------------ helpers

const TID = "aa000000-0000-0000-0000-000000000001";
const ADMIN_HEADERS = { "x-dev-role": "admin", "x-tenant-id": TID };
const INSTRUCTOR_HEADERS = { "x-dev-role": "instructor", "x-tenant-id": TID };

const EVENT_ID = "bb000000-0000-0000-0000-000000000001";
const ENTITY_ID = "cc000000-0000-0000-0000-000000000001";
const SUBMISSION_ID = "dd000000-0000-0000-0000-000000000001";
const STUDENT_ID = "ee000000-0000-0000-0000-000000000001";

/** Build a mock PoolClient whose query() returns rows in sequence. */
function makeMockClient(responses: Array<{ rows: object[] }>) {
  let callIndex = 0;
  const query = vi.fn().mockImplementation(() => {
    const resp = responses[callIndex] ?? { rows: [] };
    callIndex++;
    return Promise.resolve(resp);
  });
  return { query, release: vi.fn() };
}

beforeEach(() => vi.resetAllMocks());

// ------------------------------------------------------------------ GET /sync/status

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

// ------------------------------------------------------------------ POST /sync/flush

describe("POST /sync/flush", () => {
  it("returns 400 when x-tenant-id header is missing (#105)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      payload: { events: [] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error", "x-tenant-id header required");
  });

  it("returns 422 when events array is empty (#105)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      headers: ADMIN_HEADERS,
      payload: { events: [] },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when events array exceeds 500 (#105)", async () => {
    const app = buildApp();
    const events = Array.from({ length: 501 }, (_, i) => ({
      eventId: `bb000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      entityType: "students",
      entityId: ENTITY_ID,
      operation: "update",
      payload: { first_name: "Test" },
      clientTimestamp: new Date().toISOString(),
    }));
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      headers: ADMIN_HEADERS,
      payload: { events },
    });
    expect(res.statusCode).toBe(422);
  });

  it("skips already-received events (idempotency) (#105)", async () => {
    const mockClient = makeMockClient([
      { rows: [] },                            // BEGIN
      { rows: [] },                            // set_config
      { rows: [{ event_id: EVENT_ID }] },      // idempotency check — already stored
      { rows: [] },                            // COMMIT
    ]);
    mockConnect.mockResolvedValue(mockClient as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      headers: ADMIN_HEADERS,
      payload: {
        events: [
          {
            eventId: EVENT_ID,
            entityType: "students",
            entityId: ENTITY_ID,
            operation: "update",
            payload: { first_name: "Alice" },
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.applied).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.conflicts).toHaveLength(0);
  });

  it("returns conflict for config entity type (#105)", async () => {
    const mockClient = makeMockClient([
      { rows: [] },  // BEGIN
      { rows: [] },  // set_config
      { rows: [] },  // idempotency check — not found
      { rows: [] },  // INSERT sync_received_events
      { rows: [] },  // COMMIT
    ]);
    mockConnect.mockResolvedValue(mockClient as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      headers: ADMIN_HEADERS,
      payload: {
        events: [
          {
            eventId: EVENT_ID,
            entityType: "config",
            entityId: ENTITY_ID,
            operation: "update",
            payload: { key: "theme", value: "dark" },
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.applied).toBe(0);
    expect(body.skipped).toBe(0);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0]).toMatchObject({
      eventId: EVENT_ID,
      reason: "config_immutable",
    });
  });

  it("returns conflict when server mark is newer than clientTimestamp (#105)", async () => {
    const serverUpdatedAt = new Date("2026-06-01T12:00:00Z");
    const clientTs = new Date("2026-06-01T10:00:00Z"); // older

    const mockClient = makeMockClient([
      { rows: [] },  // BEGIN
      { rows: [] },  // set_config
      { rows: [] },  // idempotency check
      // processEvent: SELECT mark_entries
      { rows: [{ updated_at: serverUpdatedAt, score: "85" }] },
      { rows: [] },  // INSERT sync_received_events
      { rows: [] },  // COMMIT
    ]);
    mockConnect.mockResolvedValue(mockClient as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      headers: ADMIN_HEADERS,
      payload: {
        events: [
          {
            eventId: EVENT_ID,
            entityType: "marks",
            entityId: ENTITY_ID,
            operation: "update",
            payload: {
              submission_id: SUBMISSION_ID,
              student_id: STUDENT_ID,
              score: 72,
            },
            clientTimestamp: clientTs.toISOString(),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.applied).toBe(0);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0]).toMatchObject({
      eventId: EVENT_ID,
      reason: "server_version_newer",
    });
    expect(body.conflicts[0].serverValue).toMatchObject({ score: 85 });
  });

  it("applies a marks event when client timestamp is newer (#105)", async () => {
    const serverUpdatedAt = new Date("2026-06-01T08:00:00Z");
    const clientTs = new Date("2026-06-01T12:00:00Z"); // newer

    const mockClient = makeMockClient([
      { rows: [] },  // BEGIN
      { rows: [] },  // set_config
      { rows: [] },  // idempotency check
      // processEvent: SELECT mark_entries — server older
      { rows: [{ updated_at: serverUpdatedAt, score: "60" }] },
      { rows: [] },  // UPSERT mark_entries
      { rows: [] },  // INSERT sync_received_events
      { rows: [] },  // COMMIT
    ]);
    mockConnect.mockResolvedValue(mockClient as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      headers: ADMIN_HEADERS,
      payload: {
        events: [
          {
            eventId: EVENT_ID,
            entityType: "marks",
            entityId: ENTITY_ID,
            operation: "update",
            payload: {
              submission_id: SUBMISSION_ID,
              student_id: STUDENT_ID,
              score: 90,
            },
            clientTimestamp: clientTs.toISOString(),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.applied).toBe(1);
    expect(body.skipped).toBe(0);
    expect(body.conflicts).toHaveLength(0);
  });

  it("skips a students event silently when server is newer (LWW) (#105)", async () => {
    const serverUpdatedAt = new Date("2026-06-01T14:00:00Z");
    const clientTs = new Date("2026-06-01T10:00:00Z"); // older

    const mockClient = makeMockClient([
      { rows: [] },  // BEGIN
      { rows: [] },  // set_config
      { rows: [] },  // idempotency check
      // processEvent: SELECT students
      { rows: [{ updated_at: serverUpdatedAt }] },
      { rows: [] },  // INSERT sync_received_events
      { rows: [] },  // COMMIT
    ]);
    mockConnect.mockResolvedValue(mockClient as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      headers: ADMIN_HEADERS,
      payload: {
        events: [
          {
            eventId: EVENT_ID,
            entityType: "students",
            entityId: ENTITY_ID,
            operation: "update",
            payload: { first_name: "OldName" },
            clientTimestamp: clientTs.toISOString(),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.applied).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.conflicts).toHaveLength(0);
  });

  it("applies a students event when client is newer (LWW) (#105)", async () => {
    const serverUpdatedAt = new Date("2026-06-01T08:00:00Z");
    const clientTs = new Date("2026-06-01T14:00:00Z"); // newer

    const mockClient = makeMockClient([
      { rows: [] },  // BEGIN
      { rows: [] },  // set_config
      { rows: [] },  // idempotency check
      { rows: [{ updated_at: serverUpdatedAt }] },  // SELECT students
      { rows: [] },  // UPDATE students
      { rows: [] },  // INSERT sync_received_events
      { rows: [] },  // COMMIT
    ]);
    mockConnect.mockResolvedValue(mockClient as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      headers: ADMIN_HEADERS,
      payload: {
        events: [
          {
            eventId: EVENT_ID,
            entityType: "students",
            entityId: ENTITY_ID,
            operation: "update",
            payload: { first_name: "NewName" },
            clientTimestamp: clientTs.toISOString(),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.applied).toBe(1);
    expect(body.skipped).toBe(0);
    expect(body.conflicts).toHaveLength(0);
  });

  it("processes mixed batch: applied + skipped + conflict (#105)", async () => {
    const serverUpdatedAt = new Date("2026-06-01T12:00:00Z");
    const oldClientTs = new Date("2026-06-01T10:00:00Z");
    const newClientTs = new Date("2026-06-01T14:00:00Z");

    const configEventId = "bb000000-0000-0000-0000-000000000002";
    const studentsEventId = "bb000000-0000-0000-0000-000000000003";

    const mockClient = makeMockClient([
      { rows: [] },  // BEGIN
      { rows: [] },  // set_config
      { rows: [] },  // idempotency check (none already stored)

      // Event 1: config → conflict (no extra queries)
      { rows: [] },  // INSERT sync_received_events for config event

      // Event 2: marks → server newer → conflict
      { rows: [{ updated_at: serverUpdatedAt, score: "75" }] },  // SELECT mark_entries
      { rows: [] },  // INSERT sync_received_events for marks event

      // Event 3: students → client newer → applied
      { rows: [{ updated_at: serverUpdatedAt }] },  // SELECT students
      { rows: [] },  // UPDATE students
      { rows: [] },  // INSERT sync_received_events for students event

      { rows: [] },  // COMMIT
    ]);
    mockConnect.mockResolvedValue(mockClient as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/sync/flush",
      headers: INSTRUCTOR_HEADERS,
      payload: {
        events: [
          {
            eventId: configEventId,
            entityType: "config",
            entityId: ENTITY_ID,
            operation: "update",
            payload: { key: "something" },
            clientTimestamp: newClientTs.toISOString(),
          },
          {
            eventId: EVENT_ID,
            entityType: "marks",
            entityId: ENTITY_ID,
            operation: "update",
            payload: {
              submission_id: SUBMISSION_ID,
              student_id: STUDENT_ID,
              score: 50,
            },
            clientTimestamp: oldClientTs.toISOString(),
          },
          {
            eventId: studentsEventId,
            entityType: "students",
            entityId: ENTITY_ID,
            operation: "update",
            payload: { first_name: "NewName" },
            clientTimestamp: newClientTs.toISOString(),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.applied).toBe(1);
    expect(body.skipped).toBe(0);
    expect(body.conflicts).toHaveLength(2);
  });
});
