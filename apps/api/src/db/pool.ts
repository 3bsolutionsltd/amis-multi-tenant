import pg from "pg";

const { Pool } = pg;

// Lazy singleton — deferred until first use so that the .env loader in
// index.ts (which runs before any DB call) has already populated DATABASE_URL.
let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.PG_POOL_MAX ?? "10", 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // Detect dead connections (e.g. after container restarts) via TCP keepalives
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    // Prevent unhandled 'error' events from crashing the process
    _pool.on("error", (err) => {
      console.error("[pg-pool] idle client error — will be discarded", err.message);
    });
  }
  return _pool;
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
