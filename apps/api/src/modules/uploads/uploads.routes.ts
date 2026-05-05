import type { FastifyInstance } from "fastify";
import { createWriteStream, mkdirSync, unlinkSync } from "fs";
import { join, resolve, extname, basename } from "path";
import { randomUUID } from "crypto";
import { requireRole } from "../../middleware/requireRole.js";

// Allowed MIME types for evidence uploads
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function uploadsRoutes(app: FastifyInstance) {
  const uploadsDir = resolve(process.cwd(), "uploads");
  mkdirSync(uploadsDir, { recursive: true });

  // POST /uploads — multipart file upload, returns { url, name, type }
  app.post(
    "/uploads",
    { preHandler: requireRole("admin", "registrar", "hod", "instructor", "finance") },
    async (req, reply) => {
      const data = await req.file();
      if (!data) return reply.status(422).send({ error: "No file uploaded" });

      const { mimetype, filename, file } = data;

      if (!ALLOWED_TYPES.has(mimetype)) {
        // Drain the stream before returning
        file.resume();
        return reply.status(415).send({ error: `File type '${mimetype}' is not allowed` });
      }

      const ext = extname(filename) || "";
      const safeName = `${randomUUID()}${ext}`;
      const destPath = join(uploadsDir, safeName);
      const write = createWriteStream(destPath);

      let bytesWritten = 0;
      let tooLarge = false;

      for await (const chunk of file) {
        bytesWritten += (chunk as Buffer).length;
        if (bytesWritten > MAX_FILE_SIZE) {
          tooLarge = true;
          break;
        }
        write.write(chunk);
      }
      write.end();

      if (tooLarge) {
        try { unlinkSync(destPath); } catch { /* ignore */ }
        return reply.status(413).send({ error: "File exceeds 10 MB limit" });
      }

      return reply.status(201).send({
        url: `/uploads/${safeName}`,
        name: basename(filename),
        type: mimetype,
      });
    },
  );
}
