import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../../db/tenant.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getTenantId } from "../../lib/tenantId.js";

const WRITE_ROLES = ["admin", "registrar", "hod"] as const;
const READ_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
] as const;

const DOCUMENT_TYPES = [
  "photo",
  "id_card",
  "birth_certificate",
  "academic_certificate",
  "medical",
  "recommendation",
  "other",
] as const;

// 5 MB limit expressed as base64 length (~6.7 MB string)
const MAX_BASE64_LEN = 7_000_000;

const UploadDocumentSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES).default("other"),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(127),
  file_data: z
    .string()
    .min(1)
    .max(MAX_BASE64_LEN, "File exceeds 5 MB limit"),
  notes: z.string().max(500).optional(),
});

export async function studentDocumentsRoutes(app: FastifyInstance) {
  // ── GET /students/:id/documents ─────────────────────────────────────────
  // Returns metadata list (no file_data) for fast listing
  app.get(
    "/students/:id/documents",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params as { id: string };

      const rows = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `SELECT id, document_type, file_name, mime_type,
                  file_size_kb, notes, created_at
           FROM app.student_documents
           WHERE student_id = $1
           ORDER BY created_at DESC`,
          [id]
        );
        return rows;
      });

      return reply.send(rows);
    }
  );

  // ── POST /students/:id/documents ────────────────────────────────────────
  app.post(
    "/students/:id/documents",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id } = req.params as { id: string };

      const parsed = UploadDocumentSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.status(422).send({ error: parsed.error.flatten() });

      const { document_type, file_name, mime_type, file_data, notes } =
        parsed.data;

      // Rough size in KB from base64 length
      const file_size_kb = Math.round((file_data.length * 3) / 4 / 1024);

      const rows = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO app.student_documents
             (tenant_id, student_id, document_type, file_name, mime_type,
              file_data, file_size_kb, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id, document_type, file_name, mime_type, file_size_kb,
                     notes, created_at`,
          [tid, id, document_type, file_name, mime_type, file_data, file_size_kb, notes ?? null]
        );
        return rows;
      });

      return reply.status(201).send(rows[0]);
    }
  );

  // ── GET /students/:id/documents/:docId/download ─────────────────────────
  // Returns full document including file_data (for viewing/downloading)
  app.get(
    "/students/:id/documents/:docId/download",
    { preHandler: requireRole(...READ_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id, docId } = req.params as { id: string; docId: string };

      const rows = await withTenant(tid, async (client) => {
        const { rows } = await client.query(
          `SELECT id, document_type, file_name, mime_type,
                  file_data, file_size_kb, notes, created_at
           FROM app.student_documents
           WHERE id = $1 AND student_id = $2`,
          [docId, id]
        );
        return rows;
      });

      if (!rows.length)
        return reply.status(404).send({ error: "Document not found" });

      return reply.send(rows[0]);
    }
  );

  // ── DELETE /students/:id/documents/:docId ───────────────────────────────
  app.delete(
    "/students/:id/documents/:docId",
    { preHandler: requireRole(...WRITE_ROLES) },
    async (req, reply) => {
      const tid = getTenantId(req);
      if (!tid)
        return reply.status(400).send({ error: "x-tenant-id header required" });

      const { id, docId } = req.params as { id: string; docId: string };

      await withTenant(tid, async (client) => {
        await client.query(
          `DELETE FROM app.student_documents
           WHERE id = $1 AND student_id = $2`,
          [docId, id]
        );
      });

      return reply.status(204).send();
    }
  );
}
