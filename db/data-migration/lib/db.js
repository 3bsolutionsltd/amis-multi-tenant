/**
 * db.js — Thin PostgreSQL client for migration scripts.
 * Reads DATABASE_URL from environment (same as API).
 * Usage: const { query, withTenant, end } = require('../lib/db');
 */

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  // Try to load from .env at repo root
  const fs = require('fs');
  const path = require('path');
  const envPath = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m) process.env[m[1]] = m[2].trim();
    }
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Run a query in the default connection pool */
async function query(sql, params) {
  return pool.query(sql, params);
}

/**
 * Run callback inside a tenant-scoped transaction.
 * Sets `app.tenant_id` so RLS policies work correctly.
 * @param {string} tenantId  UUID of the tenant
 * @param {(client: pg.PoolClient) => Promise<T>} callback
 */
async function withTenant(tenantId, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Resolve tenant UUID from slug (e.g. 'kti') */
async function getTenantId(slug) {
  const res = await pool.query('SELECT id FROM platform.tenants WHERE slug = $1', [slug]);
  if (res.rows.length === 0) throw new Error(`Tenant not found: ${slug}`);
  return res.rows[0].id;
}

async function end() {
  await pool.end();
}

module.exports = { query, withTenant, getTenantId, end };
