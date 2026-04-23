import pg from "pg";

const { Pool } = pg;

// Lazy singleton — deferred until first use so that the .env loader in
// index.ts (which runs before any DB call) has already populated DATABASE_URL.
let _pool: pg.Pool | null = null;

function createPool(): pg.Pool {
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.PG_POOL_MAX ?? "10", 10),
    // Keep idle connections alive for 10 minutes; after that the pool
    // discards them cleanly and reconnects on demand.
    idleTimeoutMillis: 600_000,
    // Allow 10 s to establish a new connection — enough for Docker networking
    connectionTimeoutMillis: 10_000,
    // TCP keepalives prevent NAT/firewall from silently dropping idle conns
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  // Prevent unhandled 'error' events from crashing the process.
  // node-postgres emits this when an idle client has its connection dropped
  // by the server — the pool will discard the client and create a new one.
  p.on("error", (err) => {
    console.error("[pg-pool] idle client error — will be discarded:", err.message);
  });
  return p;
}

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = createPool();
  }
  return _pool;
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

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
