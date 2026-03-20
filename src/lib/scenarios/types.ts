/**
 * PRISM Scenario Explorer — Type Definitions
 *
 * Types for the scenario exploration engine that enables "what-if"
 * analysis by forking completed investigations, adjusting assumptions,
 * and re-running synthesis to detect how intelligence shifts.
 */

import { z } from "zod";
import type { IRGraph, IREmergence, IRTension, IRGap, IRFinding } from "@/lib/pipeline/ir-types";

// ─── Lever Types ─────────────────────────────────────────────

export const LeverTypeEnum = z.enum([
  "tension_flip",
  "gap_resolve",
  "metric_adjust",
  "finding_suppress",
  "finding_amplify",
]);
export type LeverType = z.infer<typeof LeverTypeEnum>;

export const ScenarioStatusEnum = z.enum([
  "draft",
  "computing",
  "complete",
  "failed",
]);
export type ScenarioStatus = z.infer<typeof ScenarioStatusEnum>;

// ─── Lever Schemas ───────────────────────────────────────────

export const TensionFlipAdjustedSchema = z.object({
  winningPosition: z.number().int().min(0),
});

export const GapResolveAdjustedSchema = z.object({
  direction: z.enum(["optimistic", "pessimistic", "neutral", "custom"]),
  assumption: z.string().min(1),
});

export const MetricAdjustAdjustedSchema = z.object({
  multiplier: z.number().min(0.1).max(10),
});

export const FindingWeightAdjustedSchema = z.number().min(0).max(2);

export const CreateLeverSchema = z.object({
  leverType: LeverTypeEnum,
  targetId: z.string().min(1),
  targetLabel: z.string().min(1),
  baseline: z.unknown(),
  adjusted: z.unknown(),
});
export type CreateLeverInput = z.infer<typeof CreateLeverSchema>;

// ─── Scenario CRUD Schemas ───────────────────────────────────

export const CreateScenarioSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  parentId: z.string().optional(),
  levers: z.array(CreateLeverSchema).optional(),
});
export type CreateScenarioInput = z.infer<typeof CreateScenarioSchema>;

export const UpdateLeversSchema = z.object({
  levers: z.array(CreateLeverSchema),
});

// ─── Delta Types ─────────────────────────────────────────────

export interface EmergenceDelta {
  type: "new" | "changed" | "removed";
  emergence: IREmergence;
  baseline?: IREmergence;
  changeDescription?: string;
}

export interface TensionDelta {
  type: "resolved" | "shifted" | "new" | "removed";
  tension: IRTension;
  baseline?: IRTension;
  changeDescription?: string;
}

export interface SensitivityEntry {
  leverId: string;
  leverLabel: string;
  leverType: LeverType;
  impactScore: number; // 0-1: how much this lever affected downstream
  affectedEmergences: string[]; // IDs of emergences that changed
  affectedTensions: string[]; // IDs of tensions that changed
}

export interface ScenarioDiff {
  emergencesDelta: EmergenceDelta[];
  tensionsDelta: TensionDelta[];
  sensitivityMap: SensitivityEntry[];
  confidenceShift: number;
  newFindings: number;
  removedFindings: number;
  summary: string;
}

// ─── Computation Result ──────────────────────────────────────

export interface ScenarioComputeResult {
  modifiedIrGraph: IRGraph;
  diff: ScenarioDiff;
  computeTimeMs: number;
}

// ─── Available Levers (for UI) ───────────────────────────────

export interface AvailableLever {
  leverType: LeverType;
  targetId: string;
  targetLabel: string;
  description: string;
  currentValue: unknown;
  /** For tension_flip: the available positions */
  options?: Array<{ label: string; agent: string; confidence: number }>;
}

export interface AvailableLevers {
  tensions: AvailableLever[];
  gaps: AvailableLever[];
  metrics: AvailableLever[];
  findings: AvailableLever[];
}

/**
 * Extract all adjustable levers from an IR Graph.
 * Used by the frontend to populate the LeverPanel.
 */
export function extractAvailableLevers(ir: IRGraph): AvailableLevers {
  const tensions: AvailableLever[] = ir.tensions
    .filter(t => t.status === "open" || t.status === "deferred")
    .map(t => ({
      leverType: "tension_flip" as const,
      targetId: t.id,
      targetLabel: t.claim,
      description: `${t.positions.length} opposing positions. ${t.resolutionStrategy ? `Strategy: ${t.resolutionStrategy}` : "Unresolved."}`,
      currentValue: { status: t.status, resolution: t.resolution },
      options: t.positions.map((p, i) => ({
        label: p.position.length > 80 ? p.position.slice(0, 80) + "…" : p.position,
        agent: p.agent,
        confidence: p.confidence,
      })),
    }));

  const gaps: AvailableLever[] = ir.gaps
    .filter(g => g.researchable)
    .map(g => ({
      leverType: "gap_resolve" as const,
      targetId: g.id,
      targetLabel: g.title,
      description: `${g.gapType} gap (${g.priority} priority). What if we knew the answer?`,
      currentValue: { gapType: g.gapType, priority: g.priority },
    }));

  const findings: AvailableLever[] = ir.findings
    .filter(f => f.confidence >= 0.6)
    .sort((a, b) => b.actionabilityScore - a.actionabilityScore)
    .slice(0, 30) // Cap at top 30 by actionability
    .map(f => ({
      leverType: "finding_amplify" as const, // Default to amplify; UI allows toggle
      targetId: f.id,
      targetLabel: f.value.length > 100 ? f.value.slice(0, 100) + "…" : f.value,
      description: `${f.agent} (${f.agentArchetype}). Confidence: ${(f.confidence * 100).toFixed(0)}%`,
      currentValue: { confidence: f.confidence, actionability: f.actionabilityScore },
    }));

  return { tensions, gaps, metrics: [], findings };
}
