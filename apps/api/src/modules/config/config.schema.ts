import { z } from "zod";

// A single workflow transition definition.
const workflowTransitionSchema = z.object({
  action: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
});

// A single workflow definition stored inside the config payload.
export const workflowDefinitionSchema = z.object({
  key: z.string().min(1),
  initial_state: z.string().min(1),
  states: z.array(z.string().min(1)).min(1),
  transitions: z.array(workflowTransitionSchema).min(1),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

// Navigation link (one entry in the sidebar for a given role).
const navItemSchema = z.object({
  label: z.string().min(1),
  route: z.string().min(1),
});

// Dashboard card — KPI shows a metric value, ACTION renders a button-link.
const dashCardSchema = z.object({
  type: z.enum(["KPI", "ACTION"]),
  label: z.string().min(1),
  metricKey: z.string().optional(),
  route: z.string().optional(),
});

// A single field definition for config-driven forms.
const formFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "date", "select", "textarea"]).default("text"),
  visible: z.boolean().default(true),
  order: z.number().int().optional(),
  options: z.array(z.string()).optional(),
});

// Per-module form configuration.
const moduleFormConfigSchema = z.object({
  fields: z.array(formFieldSchema).optional(),
  extensionFields: z.array(formFieldSchema).optional(),
});

// The shape of a tenant's configuration payload.
// Workflows live here so they benefit from config draft/validate/publish/rollback.
export const configPayloadSchema = z
  .object({
    modules: z
      .object({
        students: z.boolean().optional(),
        admissions: z.boolean().optional(),
        finance: z.boolean().optional(),
      })
      .optional(),
    branding: z
      .object({
        appName: z.string().min(1).default("AMIS"),
        logoUrl: z.string().url().optional(),
      })
      .optional(),
    theme: z
      .object({
        primaryColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "must be a valid hex color")
          .default("#2563EB"),
      })
      .optional(),
    navigation: z.record(z.string(), z.array(navItemSchema)).optional(),
    dashboards: z.record(z.string(), z.array(dashCardSchema)).optional(),
    forms: z
      .object({
        students: moduleFormConfigSchema.optional(),
      })
      .optional(),
    workflows: z.record(z.string(), workflowDefinitionSchema).optional(),
    fees: z
      .object({
        defaultTotalDue: z.number().positive().optional(),
      })
      .optional(),
  })
  .passthrough(); // allow extra keys during the pilot phase

export type ConfigPayload = z.infer<typeof configPayloadSchema>;
