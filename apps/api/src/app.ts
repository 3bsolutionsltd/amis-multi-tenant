import Fastify from "fastify";
import cors from "@fastify/cors";
import { studentsRoutes } from "./modules/students/students.routes.js";
import { configRoutes } from "./modules/config/config.routes.js";
import { workflowRoutes } from "./modules/workflow/workflow.routes.js";
import { admissionsRoutes } from "./modules/admissions/admissions.routes.js";
import { marksRoutes } from "./modules/marks/marks.routes.js";
import { feesRoutes } from "./modules/fees/fees.routes.js";
import { registerDevIdentity } from "./middleware/devIdentity.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Dev identity: populates request.user on every request (root-scope hook)
  registerDevIdentity(app);

  app.get("/health", async (_req, _reply) => {
    return { status: "ok" };
  });

  app.register(studentsRoutes);
  app.register(configRoutes);
  app.register(workflowRoutes);
  app.register(admissionsRoutes);
  app.register(marksRoutes);
  app.register(feesRoutes);

  return app;
}
