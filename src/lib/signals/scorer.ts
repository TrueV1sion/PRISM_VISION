// src/lib/signals/scorer.ts
/**
 * Bayesian Confidence Scoring
 *
 * Computes a confidence score for a detected signal using a simplified
 * Bayesian approach with adjustments for source count, temporal
 * recency, and entity match specificity.
 */

/**
 * Compute confidence score for a detected signal.
 *
 * - Start with pattern's baseConfidence
 * - Adjust for number of corroborating sources
 * - Adjust for recency (signals closer together = higher confidence)
 * - Adjust for entity specificity (exact entity match vs keyword)
 */
export function computeConfidence(params: {
  baseConfidence: number;
  sourceCount: number;
  minSources: number;
  maxTimeDeltaHours: number;
  windowHours: number;
  entityMatchStrength: "exact" | "partial" | "keyword";
}): number {
  // Source factor: more sources = higher confidence, capped at 2x
  const sourceFactor = Math.min(
    params.sourceCount / Math.max(params.minSources, 1),
    2.0,
  );

  // Recency factor: tighter temporal clustering = higher confidence
  // When maxTimeDelta is 0 (simultaneous), factor is 1.0
  // When maxTimeDelta equals windowHours, factor is 0.7
  const recencyFactor =
    1 - (params.maxTimeDeltaHours / Math.max(params.windowHours, 1)) * 0.3;

  // Entity match factor: exact matches boost confidence
  const entityFactor =
    params.entityMatchStrength === "exact"
      ? 1.1
      : params.entityMatchStrength === "partial"
        ? 1.0
        : 0.85;

  const raw = params.baseConfidence * sourceFactor * recencyFactor * entityFactor;

  // Clamp to [0.1, 0.99] — never fully certain, never fully dismissed
  return Math.min(Math.max(raw, 0.1), 0.99);
}
