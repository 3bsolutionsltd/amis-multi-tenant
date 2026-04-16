import Fastify from "fastify";
import cors from "@fastify/cors";
import { studentsRoutes } from "./modules/students/students.routes.js";
import { configRoutes } from "./modules/config/config.routes.js";
import { workflowRoutes } from "./modules/workflow/workflow.routes.js";
import { admissionsRoutes } from "./modules/admissions/admissions.routes.js";
import { marksRoutes } from "./modules/marks/marks.routes.js";
import { feesRoutes } from "./modules/fees/fees.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { termRegistrationsRoutes } from "./modules/term-registrations/term-registrations.routes.js";
import { programmesRoutes } from "./modules/programmes/programmes.routes.js";
import { staffRoutes } from "./modules/staff/staff.routes.js";
import { industrialTrainingRoutes } from "./modules/industrial-training/industrial-training.routes.js";
import { fieldPlacementsRoutes } from "./modules/field-placements/field-placements.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { registerDevIdentity } from "./middleware/devIdentity.js";
import { requireAuth } from "./middleware/requireAuth.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Hook 1: dev identity — populates req.user from x-dev-role headers (dev/test only)
  registerDevIdentity(app);
  // Hook 2: JWT auth — verifies Bearer token when devIdentity didn't set req.user
  app.addHook("onRequest", requireAuth);

  app.get("/health", async (_req, _reply) => {
    return { status: "ok" };
  });

  app.register(authRoutes);
  app.register(usersRoutes);
  app.register(studentsRoutes);
  app.register(configRoutes);
  app.register(workflowRoutes);
  app.register(admissionsRoutes);
  app.register(marksRoutes);
  app.register(feesRoutes);
  app.register(termRegistrationsRoutes);
  app.register(programmesRoutes);
  app.register(staffRoutes);
  app.register(industrialTrainingRoutes);
  app.register(fieldPlacementsRoutes);
  app.register(analyticsRoutes);

  return app;
}
