// src/lib/signals/index.ts
/**
 * Signal Correlation Engine — Barrel Exports
 */

export { SignalCorrelator } from "./correlator";
export type { CorrelationCandidate } from "./correlator";
export { CORRELATION_PATTERNS, type CorrelationPattern } from "./patterns";
export { SignalEmitter } from "./emitter";
export type { EmitResult } from "./emitter";
export { computeConfidence } from "./scorer";
export { runSentinel } from "./sentinel";
export type { SentinelResult } from "./sentinel";
