import type { PoolClient, QueryResult } from "pg";
import { pool, isConnectionError } from "./pool.js";

/**
 * Run a callback inside a transaction with tenant isolation enforced.
 * The API sets `app.tenant_id` per transaction so RLS policies can read it.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let connectionDied = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    await client.query(
      `SET LOCAL statement_timeout = '${parseInt(process.env.STATEMENT_TIMEOUT_MS ?? "30000", 10)}'`,
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    connectionDied = isConnectionError(err);
    // Rolling back on a dead socket would just throw again — skip it.
    if (!connectionDied) await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    // Discard the client on a connection-level error instead of returning a
    // dead connection to the pool, where every future request would reuse it.
    client.release(connectionDied);
  }
}

export type { QueryResult, PoolClient };
