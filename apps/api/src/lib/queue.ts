/**
 * BullMQ queue setup — outbox event draining
 *
 * Redis is optional.  If REDIS_URL is not set the queue and worker are
 * disabled and the app starts normally (events accumulate in the DB table
 * until Redis becomes available).
 */
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { superPool } from "../db/pool.js";

export type OutboxQueue = Queue;
export type OutboxWorker = Worker;

let _connection: Redis | null = null;
let _queue: Queue | null = null;
let _worker: Worker | null = null;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _pollInFlight = false;
let _pollFailureCount = 0;
let _nextPollAt = 0;

// -----------------------------------------------------------------------
// Connection
// -----------------------------------------------------------------------

export function createRedisConnection(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const conn = new Redis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  });
  conn.on("error", (err: Error) => {
    // Log but don't crash — the worker will back off automatically
    console.error("[redis] connection error:", err.message);
  });
  return conn;
}

// -----------------------------------------------------------------------
// Queue accessor (null when Redis is unavailable)
// -----------------------------------------------------------------------

export function getOutboxQueue(): Queue | null {
  return _queue;
}

// -----------------------------------------------------------------------
// Worker startup
// -----------------------------------------------------------------------

/**
 * Start the BullMQ outbox worker.
 * @param pollIntervalMs  How often to poll the DB for unprocessed events
 *                        (default 5 s; lower this in tests via env/param)
 */
export async function startOutboxWorker(pollIntervalMs = 5_000): Promise<void> {
  _connection = createRedisConnection();
  if (!_connection) {
    console.warn(
      "[outbox] REDIS_URL not set — outbox worker disabled; events will accumulate in platform.outbox_events"
    );
    return;
  }

  _queue = new Queue("outbox", { connection: _connection });

  // Worker: receives jobs enqueued by the poller.
  // Job ID = event UUID → BullMQ deduplicates automatically.
  _worker = new Worker(
    "outbox",
    async (job) => {
      const { eventId } = job.data as { eventId: string };
      await superPool.query(
        `UPDATE platform.outbox_events
            SET processed_at = now()
          WHERE id = $1
            AND processed_at IS NULL`,
        [eventId]
      );
    },
    { connection: _connection }
  );

  _worker.on("failed", (job, err) => {
    console.error(`[outbox] job ${job?.id} failed:`, err.message);
  });

  // Poller: reads unprocessed rows from DB and enqueues them.
  // Using the event UUID as job ID makes re-enqueueing idempotent.
  _pollTimer = setInterval(async () => {
    // A failed connection can take up to the pool connection timeout to
    // resolve. Never start another poll while the previous one is pending.
    if (_pollInFlight || Date.now() < _nextPollAt) return;
    _pollInFlight = true;
    try {
      const { rows } = await superPool.query<{ id: string }>(
        `SELECT id
           FROM platform.outbox_events
          WHERE processed_at IS NULL
          ORDER BY created_at
          LIMIT 100`
      );
      _pollFailureCount = 0;
      _nextPollAt = 0;
      if (rows.length === 0) return;
      for (const { id } of rows) {
        await _queue!.add("process", { eventId: id }, { jobId: id });
      }
    } catch (err) {
      _pollFailureCount = Math.min(_pollFailureCount + 1, 6);
      const backoffSeconds = Math.min(60, 2 ** _pollFailureCount);
      _nextPollAt = Date.now() + backoffSeconds * 1000;
      console.error(
        `[outbox] poll error (retry backoff ${backoffSeconds}s):`,
        (err as Error).message,
      );
    } finally {
      _pollInFlight = false;
    }
  }, pollIntervalMs);
}

// -----------------------------------------------------------------------
// Graceful shutdown
// -----------------------------------------------------------------------

export async function stopOutboxWorker(): Promise<void> {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  _pollInFlight = false;
  _pollFailureCount = 0;
  _nextPollAt = 0;
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
  if (_connection) {
    await _connection.quit();
    _connection = null;
  }
}
