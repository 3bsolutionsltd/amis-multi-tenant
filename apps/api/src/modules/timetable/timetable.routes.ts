import type { FastifyInstance } from "fastify";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";
import {
  CreateTimetableSlotSchema,
  UpdateTimetableSlotSchema,
  TimetableQuerySchema,
} from "./timetable.schema.js";

const WRITE_ROLES = ["admin", "registrar"] as const;
const READ_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
] as const;

const SLOT_COLS = `
  id, programme, academic_year, term_number,
  day_of_week, start_time, end_time,
  course_id, room, instructor_name, notes,
  created_at, updated_at
`;

export async function timetableRoutes(app: FastifyInstance) {
  // ── GET /timetable ──────────────────────────────────────────────────────
  app.get(
    "/timetable",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = TimetableQuerySchema.safeParse(req.query);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { programme, academic_year, term_number, day_of_week } =
        parsed.data;

      const rows = await withTenant(tid, async (client) => {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (programme) {
          params.push(programme);
          conditions.push(`programme = $${params.length}`);
        }
        if (academic_year) {
          params.push(academic_year);
          conditions.push(`academic_year = $${params.length}`);
        }
        if (term_number != null) {
          params.push(term_number);
          conditions.push(`term_number = $${params.length}`);
        }
        if (day_of_week) {
          params.push(day_of_week);
          conditions.push(`day_of_week = $${params.length}`);
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const { rows } = await client.query(
          `SELECT ${SLOT_COLS}
           FROM app.timetable_slots
           ${where}
           ORDER BY
             CASE day_of_week
               WHEN 'Monday'    THEN 1
               WHEN 'Tuesday'   THEN 2
               WHEN 'Wednesday' THEN 3
               WHEN 'Thursday'  THEN 4
               WHEN 'Friday'    THEN 5
               WHEN 'Saturday'  THEN 6
             END,
             start_time ASC`,
          params,
        );
        return rows;
      });

      return reply.status(200).send(rows);
    },
  );

  // ── POST /timetable ─────────────────────────────────────────────────────
  app.post(
    "/timetable",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const parsed = CreateTimetableSlotSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const d = parsed.data;

      const slot = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO app.timetable_slots
             (tenant_id, programme, academic_year, term_number,
              day_of_week, start_time, end_time,
              course_id, room, instructor_name, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING ${SLOT_COLS}`,
          [
            tid,
            d.programme ?? null,
            d.academic_year ?? null,
            d.term_number ?? null,
            d.day_of_week,
            d.start_time,
            d.end_time,
            d.course_id,
            d.room ?? null,
            d.instructor_name ?? null,
            d.notes ?? null,
          ],
        );
        return rows[0];
      });

      return reply.status(201).send(slot);
    },
  );

  // ── PUT /timetable/:id ──────────────────────────────────────────────────
  app.put(
    "/timetable/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params as { id: string };

      const parsed = UpdateTimetableSlotSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const d = parsed.data;
      if (Object.keys(d).length === 0)
        return reply.status(422).send({ error: "No fields to update" });

      const updates: string[] = [];
      const params: unknown[] = [];

      const fieldMap: Record<string, unknown> = {
        programme: d.programme,
        academic_year: d.academic_year,
        term_number: d.term_number,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        course_id: d.course_id,
        room: d.room,
        instructor_name: d.instructor_name,
        notes: d.notes,
      };

      for (const [col, val] of Object.entries(fieldMap)) {
        if (val !== undefined) {
          params.push(val);
          updates.push(`${col} = $${params.length}`);
        }
      }

      params.push("now()");
      updates.push(`updated_at = $${params.length}`);

      params.push(id);
      const idParam = `$${params.length}`;

      const slot = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `UPDATE app.timetable_slots
           SET ${updates.join(", ")}
           WHERE id = ${idParam}
           RETURNING ${SLOT_COLS}`,
          params,
        );
        return rows[0] ?? null;
      });

      if (!slot) return reply.status(404).send({ error: "Slot not found" });
      return reply.status(200).send(slot);
    },
  );

  // ── DELETE /timetable/:id ───────────────────────────────────────────────
  app.delete(
    "/timetable/:id",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params as { id: string };

      const deleted = await withTenant(tid, async (client) => {
        const { rowCount } = await client.query(
          `DELETE FROM app.timetable_slots WHERE id = $1`,
          [id],
        );
        return rowCount ?? 0;
      });

      if (!deleted) return reply.status(404).send({ error: "Slot not found" });
      return reply.status(200).send({ deleted: true });
    },
  );
}
