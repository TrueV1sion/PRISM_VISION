/**
 * PRISM Shared UI Types
 *
 * Re-exports pipeline types for the UI layer plus app phase definitions.
 */

// Re-export from pipeline types
export type {
  SwarmTier,
  ConfidenceLevel,
  AutonomyMode,
  AgentFinding,
  Blueprint,
  SynthesisLayer,
  PipelineEvent,
} from "./pipeline/types";

// ─── App Phases ─────────────────────────────────────────────

export type Phase =
  | "input"
  | "blueprint"
  | "executing"
  | "triage"
  | "synthesis"
  | "complete"
  | "library"
  | "viewer"
  | "settings";
