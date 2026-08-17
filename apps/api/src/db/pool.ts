import pg from "pg";

const { Pool } = pg;

// Lazy singleton — deferred until first use so that the .env loader in
// index.ts (which runs before any DB call) has already populated DATABASE_URL.
let _pool: pg.Pool | null = null;

function createPool(): pg.Pool {
  // Prefer APP_DATABASE_URL (non-superuser amis_app role) so that PostgreSQL
  // Row-Level Security is enforced. Fall back to DATABASE_URL for local dev
  // environments that haven't set APP_DATABASE_URL yet.
  // NEVER use a superuser connection for application queries — superusers
  // bypass RLS unconditionally in PostgreSQL, even with FORCE ROW LEVEL SECURITY.
  const connectionString =
    process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
  const p = new Pool({
    connectionString,
    max: parseInt(process.env.PG_POOL_MAX ?? "10", 10),
    // Recycle idle connections after 30 s so the pool never reuses a
    // connection that was silently dropped by the OS / NAT / firewall.
    idleTimeoutMillis: 30_000,
    // Allow 10 s to establish a new connection — enough for Docker networking
    connectionTimeoutMillis: 10_000,
    // TCP keepalives prevent NAT/firewall from silently dropping idle conns
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  // Prevent unhandled 'error' events from crashing the process.
  // node-postgres emits this when an idle client has its connection dropped
  // by the server — the pool will discard the client and create a new one.
  //
  // Recovery: after RECOVERY_THRESHOLD consecutive idle-client errors the pool
  // is considered wedged (all connections simultaneously stale).  We end it
  // and clear _pool so the next request transparently creates a fresh pool —
  // no container restart required.
  const RECOVERY_THRESHOLD = 3;
  let consecutiveErrors = 0;

  p.on("error", (err) => {
    console.error("[pg-pool] idle client error — will be discarded:", err.message);
    consecutiveErrors++;
    if (consecutiveErrors >= RECOVERY_THRESHOLD && _pool === p) {
      consecutiveErrors = 0;
      _pool = null;
      console.error("[pg-pool] pool replaced after consecutive idle-client errors");
      p.end().catch((e: Error) =>
        console.error("[pg-pool] error ending stale pool:", e.message),
      );
    }
  });

  p.on("connect", () => {
    consecutiveErrors = 0;
  });

  return p;
}

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = createPool();
  }
  return _pool;
}

const CONNECTION_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
]);

/**
 * True when an error means the underlying socket died (long idle period with
 * a NAT/firewall/conntrack drop, server restart, etc.) rather than a routine
 * SQL error such as a constraint violation. A client that hit this kind of
 * error must be discarded from the pool — reusing it will fail forever,
 * which is why "database unreachable" used to persist until a full
 * container restart instead of self-healing on the next request.
 */
export function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    (code != null && CONNECTION_ERROR_CODES.has(code)) ||
    /connection terminated|terminating connection|server closed the connection/i.test(
      message,
    )
  );
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ---------------------------------------------------------------------------
// Superuser pool — uses DATABASE_URL (postgres role) which bypasses RLS.
// Use ONLY for auth operations (login, token refresh, OTP) that run before
// a tenant context is established.  All other queries must use `pool`.
// ---------------------------------------------------------------------------
let _superPool: pg.Pool | null = null;

function getSuperPool(): pg.Pool {
  if (!_superPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — cannot create superuser pool");
    }
    const p = new Pool({
      connectionString,
      max: 5, // small — only used for auth
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    p.on("error", (err) => {
      console.error("[super-pool] idle client error:", err.message);
    });
    _superPool = p;
  }
  return _superPool;
}

export const superPool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    return (getSuperPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** @internal — test-only; resets the lazy pool singleton so the next access creates a fresh pool. */
export function _resetPoolForTesting(): void {
  _pool = null;
  _superPool = null;
}

// Keepalive ping every 5 minutes — prevents NAT/firewall from silently
// dropping idle connections between the API and Postgres containers.
// This runs a cheap SELECT 1 using a borrowed connection so node-postgres
// resets the idle timer on every client in the pool.
setInterval(
  () => {
    getPool()
      .query("SELECT 1")
      .catch((err: Error) =>
        console.error("[pg-pool] keepalive ping failed:", err.message),
      );
  },
  5 * 60 * 1000,
).unref(); // .unref() lets the Node process exit normally even if this timer is pending
