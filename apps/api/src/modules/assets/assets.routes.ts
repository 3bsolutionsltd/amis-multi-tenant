import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";

const ALL_ROLES = ["admin", "registrar", "finance", "principal", "hod", "dean", "instructor", "procurement_officer", "inventory_manager"] as const;
const MASTER_COLS = "id, asset_code, name, category, description, default_useful_life_years, is_active, created_at, updated_at";
const ASSET_RETURN_COLS = "id, master_asset_id, asset_tag, serial_number, status, acquisition_date, acquisition_cost, location, custody_department, custody_holder, notes, created_at, updated_at";
const ASSET_SELECT_COLS = "a.id, a.master_asset_id, a.asset_tag, a.serial_number, a.status, a.acquisition_date, a.acquisition_cost, a.location, a.custody_department, a.custody_holder, a.notes, a.created_at, a.updated_at";

const MasterAssetSchema = z.object({
  asset_code: z.string().min(1), name: z.string().min(1), category: z.string().min(1),
  description: z.string().optional(), default_useful_life_years: z.number().int().positive().optional(),
});
const AssetSchema = z.object({
  master_asset_id: z.string().uuid(), asset_tag: z.string().min(1), serial_number: z.string().optional(),
  status: z.enum(["active", "in_repair", "disposed", "lost", "transferred"]).optional(),
  acquisition_date: z.string().optional(), acquisition_cost: z.number().nonnegative().optional(),
  location: z.string().optional(), custody_department: z.string().optional(), custody_holder: z.string().optional(), notes: z.string().optional(),
});

export async function assetsRoutes(app: FastifyInstance) {
  app.get("/assets/master", { preHandler: requireRole(...ALL_ROLES) }, async (req) => {
    const { tenantId } = req.user;
    return withTenant(tenantId, async (db) => (await db.query(`SELECT ${MASTER_COLS} FROM app.master_assets ORDER BY category, name`)).rows);
  });

  app.post("/assets/master", { preHandler: requireRole(...ALL_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const d = MasterAssetSchema.parse(req.body);
    const { rows } = await withTenant(tenantId, (db) => db.query(
      `INSERT INTO app.master_assets (tenant_id, asset_code, name, category, description, default_useful_life_years)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${MASTER_COLS}`,
      [tenantId, d.asset_code, d.name, d.category, d.description ?? null, d.default_useful_life_years ?? null],
    ));
    return reply.code(201).send(rows[0]);
  });

  app.get("/assets", { preHandler: requireRole(...ALL_ROLES) }, async (req) => {
    const { tenantId } = req.user;
    const q = req.query as { search?: string; status?: string; custody_department?: string };
    const params: unknown[] = [tenantId];
    const conditions = ["a.tenant_id = $1"];
    if (q.search) { params.push(`%${q.search}%`); conditions.push(`(a.asset_tag ILIKE $${params.length} OR a.serial_number ILIKE $${params.length} OR m.name ILIKE $${params.length})`); }
    if (q.status) { params.push(q.status); conditions.push(`a.status = $${params.length}`); }
    if (q.custody_department) { params.push(q.custody_department); conditions.push(`a.custody_department = $${params.length}`); }
    return withTenant(tenantId, async (db) => (await db.query(
      `SELECT ${ASSET_SELECT_COLS}, m.asset_code, m.name AS master_name, m.category
       FROM app.assets a JOIN app.master_assets m ON m.id = a.master_asset_id
       WHERE ${conditions.join(" AND ")} ORDER BY a.created_at DESC`, params,
    )).rows);
  });

  app.post("/assets", { preHandler: requireRole(...ALL_ROLES) }, async (req, reply) => {
    const { tenantId } = req.user;
    const d = AssetSchema.parse(req.body);
    const { rows } = await withTenant(tenantId, (db) => db.query(
      `INSERT INTO app.assets (tenant_id, master_asset_id, asset_tag, serial_number, status, acquisition_date, acquisition_cost, location, custody_department, custody_holder, notes)
      VALUES ($1,$2,$3,$4,COALESCE($5,'active'),$6,$7,$8,$9,$10,$11) RETURNING ${ASSET_RETURN_COLS}`,
      [tenantId, d.master_asset_id, d.asset_tag, d.serial_number ?? null, d.status ?? null, d.acquisition_date ?? null, d.acquisition_cost ?? null, d.location ?? null, d.custody_department ?? null, d.custody_holder ?? null, d.notes ?? null],
    ));
    return reply.code(201).send(rows[0]);
  });
}
