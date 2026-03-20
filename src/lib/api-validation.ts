/**
 * Shared Zod schemas for API route input validation.
 *
 * Every API route that accepts user input should validate with these schemas
 * before processing. This prevents malformed inputs, injection attacks,
 * and unexpected payloads from reaching business logic.
 */

import { z } from "zod";

// ─── Common Primitives ───────────────────────────────────

/** CUID format (Prisma default IDs) */
export const CuidSchema = z.string().min(1).max(30);

/** Run ID parameter */
export const RunIdSchema = CuidSchema;

/** Pagination parameters */
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Pipeline Execute ────────────────────────────────────

export const PipelineExecuteSchema = z.object({
  query: z.string().min(10, "Query must be at least 10 characters").max(5000, "Query must be under 5000 characters"),
  runId: CuidSchema,
  autonomyMode: z.enum(["supervised", "guided", "autonomous"]).default("supervised"),
});

// ─── Pipeline Triage ─────────────────────────────────────

export const TriageActionSchema = z.object({
  findingIndex: z.number().int().min(0),
  agentName: z.string().min(1),
  action: z.enum(["keep", "dismiss", "boost", "flag"]),
  reason: z.string().max(500).optional(),
});

export const PipelineTriageSchema = z.object({
  runId: CuidSchema,
  actions: z.array(TriageActionSchema).min(1).max(500),
});

// ─── Pipeline Approve ────────────────────────────────────

export const PipelineApproveSchema = z.object({
  runId: CuidSchema,
});

// ─── History Filters ─────────────────────────────────────

export const HistoryQuerySchema = z.object({
  tier: z.enum(["ALL", "MICRO", "STANDARD", "EXTENDED", "MEGA", "CAMPAIGN"]).default("ALL"),
  status: z.string().max(50).default("ALL"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ─── Run Update ──────────────────────────────────────────

export const RunUpdateSchema = z.object({
  status: z.string().max(50).optional(),
  completedAt: z.string().datetime().optional(),
}).refine(data => Object.keys(data).length > 0, "At least one field must be provided");

// ─── Settings ────────────────────────────────────────────

export const SettingsUpdateSchema = z.object({
  data: z.string().max(50000).optional(), // JSON blob
  onboardingDismissed: z.boolean().optional(),
  hasCompletedTour: z.boolean().optional(),
});

// ─── Slide Update ────────────────────────────────────────

export const SlideUpdateSchema = z.object({
  content: z.record(z.string(), z.unknown()).optional(),
  templateId: z.string().max(10).optional(),
  backgroundVariant: z.string().max(30).optional(),
  animationType: z.string().max(30).optional(),
});

// ─── Annotation ──────────────────────────────────────────

export const AnnotationCreateSchema = z.object({
  content: z.string().min(1).max(5000),
  targetField: z.string().max(100).optional(),
  authorName: z.string().max(100).optional(),
});

// ─── Scenario ────────────────────────────────────────────

export const ScenarioCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  levers: z.array(z.object({
    leverType: z.enum(["tension_flip", "gap_resolve", "metric_adjust", "finding_suppress", "finding_amplify"]),
    targetId: z.string().min(1),
    targetLabel: z.string().min(1).max(500),
    baseline: z.unknown(),
    adjusted: z.unknown(),
  })).min(1).max(20),
});

// ─── Helper: Validate and return parsed data or 400 response ───

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { success: false, error: issues };
  }
  return { success: true, data: result.data };
}

export function validateParams<T>(schema: z.ZodSchema<T>, params: unknown):
  { success: true; data: T } | { success: false; error: string } {
  return validateBody(schema, params);
}
