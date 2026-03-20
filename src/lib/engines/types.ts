import { z } from "zod/v4";

export const EngineStatusSchema = z.enum(["active", "coming-soon", "hidden"]);
export type EngineStatus = z.infer<typeof EngineStatusSchema>;

export const EngineManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  description: z.string(),
  icon: z.string(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColorName: z.string(),
  status: EngineStatusSchema,
  order: z.number().int().min(0),
  route: z.string(),
  isDefault: z.boolean(),
  /** Archetype IDs this engine scopes to during pipeline execution */
  archetypes: z.array(z.string()).optional(),
  /** Pre-filled example query shown in the engine dashboard */
  defaultQuery: z.string().optional(),
  /** Data source routing tags this engine focuses on */
  dataSourceTags: z.array(z.string()).optional(),
});

export type EngineManifest = z.infer<typeof EngineManifestSchema>;

export type EngineId =
  | "command-center"
  | "ma"
  | "sales"
  | "regulatory"
  | "product"
  | "finance";
