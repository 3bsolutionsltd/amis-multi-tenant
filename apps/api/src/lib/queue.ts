/**
 * BullMQ queue setup — outbox event draining
 *
 * Redis is optional.  If REDIS_URL is not set the queue and worker are
 * disabled and the app starts normally (events accumulate in the DB table
 * until Redis becomes available).
 */
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { superPool } from "../db/pool.js";

export type OutboxQueue = Queue;
export type OutboxWorker = Worker;

let _connection: IORedis | null = null;
let _queue: Queue | null = null;
let _worker: Worker | null = null;
let _pollTimer: ReturnType<typeof setInterval> | null = null;

// -----------------------------------------------------------------------
// Connection
// -----------------------------------------------------------------------

export function createRedisConnection(): IORedis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const conn = new IORedis(url, {
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
    try {
      const { rows } = await superPool.query<{ id: string }>(
        `SELECT id
           FROM platform.outbox_events
          WHERE processed_at IS NULL
          ORDER BY created_at
          LIMIT 100`
      );
      if (rows.length === 0) return;
      for (const { id } of rows) {
        await _queue!.add("process", { eventId: id }, { jobId: id });
      }
    } catch (err) {
      console.error("[outbox] poll error:", (err as Error).message);
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
