/**
 * PRISM Scenario Diff Engine
 *
 * Compares a modified IR Graph against a baseline to detect:
 * - New emergences that appeared
 * - Emergences that changed or disappeared
 * - Tension shifts
 * - Overall confidence movement
 */

import type { IRGraph, IREmergence, IRTension } from "@/lib/pipeline/ir-types";
import type {
  ScenarioDiff,
  EmergenceDelta,
  TensionDelta,
  SensitivityEntry,
} from "./types";

/**
 * Diff two IR Graphs to produce a ScenarioDiff.
 */
export function diffIRGraphs(
  baseline: IRGraph,
  modified: IRGraph,
  levers: Array<{ id: string; targetId: string; targetLabel: string; leverType: string }>,
): ScenarioDiff {
  const emergencesDelta = diffEmergences(baseline.emergences, modified.emergences);
  const tensionsDelta = diffTensions(baseline.tensions, modified.tensions);

  // Confidence shift
  const baselineConfidence = computeOverallConfidence(baseline);
  const modifiedConfidence = computeOverallConfidence(modified);
  const confidenceShift = modifiedConfidence - baselineConfidence;

  // Finding counts
  const baselineFindingIds = new Set(baseline.findings.map(f => f.id));
  const modifiedFindingIds = new Set(modified.findings.map(f => f.id));
  const newFindings = modified.findings.filter(f => !baselineFindingIds.has(f.id)).length;
  const removedFindings = baseline.findings.filter(f => !modifiedFindingIds.has(f.id)).length;

  // Generate summary
  const summaryParts: string[] = [];
  const newEmergences = emergencesDelta.filter(d => d.type === "new").length;
  const removedEmergences = emergencesDelta.filter(d => d.type === "removed").length;
  const changedEmergences = emergencesDelta.filter(d => d.type === "changed").length;
  const resolvedTensions = tensionsDelta.filter(d => d.type === "resolved").length;

  if (newEmergences > 0) summaryParts.push(`+${newEmergences} new emergence${newEmergences > 1 ? "s" : ""}`);
  if (removedEmergences > 0) summaryParts.push(`-${removedEmergences} lost emergence${removedEmergences > 1 ? "s" : ""}`);
  if (changedEmergences > 0) summaryParts.push(`~${changedEmergences} shifted emergence${changedEmergences > 1 ? "s" : ""}`);
  if (resolvedTensions > 0) summaryParts.push(`${resolvedTensions} tension${resolvedTensions > 1 ? "s" : ""} resolved`);
  if (Math.abs(confidenceShift) > 0.05) {
    summaryParts.push(`confidence ${confidenceShift > 0 ? "+" : ""}${(confidenceShift * 100).toFixed(1)}%`);
  }

  return {
    emergencesDelta,
    tensionsDelta,
    sensitivityMap: [], // Populated by the caller
    confidenceShift,
    newFindings,
    removedFindings,
    summary: summaryParts.length > 0 ? summaryParts.join(", ") : "No significant changes detected",
  };
}

// ─── Emergence Diffing ───────────────────────────────────────

function diffEmergences(
  baseline: IREmergence[],
  modified: IREmergence[],
): EmergenceDelta[] {
  const deltas: EmergenceDelta[] = [];

  // Build fingerprints for semantic matching
  // Since scenario re-synthesis generates new IDs, we match by content similarity
  const baselineFingerprints = baseline.map(e => ({
    emergence: e,
    fingerprint: emergenceFingerprint(e),
  }));
  const modifiedFingerprints = modified.map(e => ({
    emergence: e,
    fingerprint: emergenceFingerprint(e),
  }));

  const matchedBaseline = new Set<number>();
  const matchedModified = new Set<number>();

  // Pass 1: Find exact or near matches
  for (let mi = 0; mi < modifiedFingerprints.length; mi++) {
    let bestBaselineIdx = -1;
    let bestSimilarity = 0;

    for (let bi = 0; bi < baselineFingerprints.length; bi++) {
      if (matchedBaseline.has(bi)) continue;
      const sim = fingerprintSimilarity(
        modifiedFingerprints[mi].fingerprint,
        baselineFingerprints[bi].fingerprint,
      );
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestBaselineIdx = bi;
      }
    }

    if (bestSimilarity > 0.6 && bestBaselineIdx >= 0) {
      // Matched — check if changed
      matchedBaseline.add(bestBaselineIdx);
      matchedModified.add(mi);

      if (bestSimilarity < 0.95) {
        deltas.push({
          type: "changed",
          emergence: modifiedFingerprints[mi].emergence,
          baseline: baselineFingerprints[bestBaselineIdx].emergence,
          changeDescription: describeEmergenceChange(
            baselineFingerprints[bestBaselineIdx].emergence,
            modifiedFingerprints[mi].emergence,
          ),
        });
      }
      // If similarity >= 0.95, it's essentially unchanged — skip
    }
  }

  // Pass 2: Unmatched modified = new emergences
  for (let mi = 0; mi < modifiedFingerprints.length; mi++) {
    if (matchedModified.has(mi)) continue;
    deltas.push({
      type: "new",
      emergence: modifiedFingerprints[mi].emergence,
      changeDescription: "New emergence detected in scenario",
    });
  }

  // Pass 3: Unmatched baseline = removed emergences
  for (let bi = 0; bi < baselineFingerprints.length; bi++) {
    if (matchedBaseline.has(bi)) continue;
    deltas.push({
      type: "removed",
      emergence: baselineFingerprints[bi].emergence,
      changeDescription: "Emergence no longer detected in scenario",
    });
  }

  return deltas;
}

// ─── Tension Diffing ─────────────────────────────────────────

function diffTensions(
  baseline: IRTension[],
  modified: IRTension[],
): TensionDelta[] {
  const deltas: TensionDelta[] = [];

  const baselineMap = new Map(baseline.map(t => [tensionFingerprint(t), t]));
  const modifiedMap = new Map(modified.map(t => [tensionFingerprint(t), t]));

  const matchedBaseline = new Set<string>();

  for (const [mfp, mTension] of modifiedMap) {
    // Try exact match first
    if (baselineMap.has(mfp)) {
      matchedBaseline.add(mfp);
      const bTension = baselineMap.get(mfp)!;
      if (bTension.status !== mTension.status) {
        deltas.push({
          type: mTension.status === "resolved" ? "resolved" : "shifted",
          tension: mTension,
          baseline: bTension,
          changeDescription: `Status changed: ${bTension.status} → ${mTension.status}`,
        });
      }
      continue;
    }

    // Try fuzzy match
    let bestKey = "";
    let bestSim = 0;
    for (const [bfp, bTension] of baselineMap) {
      if (matchedBaseline.has(bfp)) continue;
      const sim = stringSimilarity(mTension.claim, bTension.claim);
      if (sim > bestSim) {
        bestSim = sim;
        bestKey = bfp;
      }
    }

    if (bestSim > 0.5 && bestKey) {
      matchedBaseline.add(bestKey);
      const bTension = baselineMap.get(bestKey)!;
      deltas.push({
        type: "shifted",
        tension: mTension,
        baseline: bTension,
        changeDescription: `Tension shifted from "${bTension.claim.slice(0, 60)}…"`,
      });
    } else {
      deltas.push({
        type: "new",
        tension: mTension,
        changeDescription: "New tension detected in scenario",
      });
    }
  }

  // Removed tensions
  for (const [bfp, bTension] of baselineMap) {
    if (!matchedBaseline.has(bfp)) {
      deltas.push({
        type: "removed",
        tension: bTension,
        changeDescription: "Tension no longer present in scenario",
      });
    }
  }

  return deltas;
}

// ─── Fingerprinting & Similarity ─────────────────────────────

interface EmergenceFingerprint {
  words: Set<string>;
  algorithm: string;
  agentCount: number;
}

function emergenceFingerprint(e: IREmergence): EmergenceFingerprint {
  const words = new Set(
    e.insight
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 3),
  );
  return {
    words,
    algorithm: e.algorithm,
    agentCount: e.supportingAgents.length,
  };
}

function fingerprintSimilarity(a: EmergenceFingerprint, b: EmergenceFingerprint): number {
  // Jaccard similarity on word sets + algorithm match bonus
  const intersection = new Set([...a.words].filter(w => b.words.has(w)));
  const union = new Set([...a.words, ...b.words]);
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;
  const algorithmBonus = a.algorithm === b.algorithm ? 0.1 : 0;
  return Math.min(1, jaccard + algorithmBonus);
}

function tensionFingerprint(t: IRTension): string {
  // Normalize the claim to create a stable key
  return t.claim
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .sort()
    .join(" ");
}

function stringSimilarity(a: string, b: string): number {
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const bWords = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const intersection = new Set([...aWords].filter(w => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function describeEmergenceChange(baseline: IREmergence, modified: IREmergence): string {
  const parts: string[] = [];

  // Check quality score changes
  const bScores = baseline.qualityScores;
  const mScores = modified.qualityScores;
  const scoreFields = ["novelty", "grounding", "actionability", "depth", "surprise"] as const;

  for (const field of scoreFields) {
    const diff = mScores[field] - bScores[field];
    if (Math.abs(diff) >= 1) {
      parts.push(`${field} ${diff > 0 ? "+" : ""}${diff}`);
    }
  }

  // Check agent changes
  const newAgents = modified.supportingAgents.filter(a => !baseline.supportingAgents.includes(a));
  const lostAgents = baseline.supportingAgents.filter(a => !modified.supportingAgents.includes(a));
  if (newAgents.length > 0) parts.push(`+${newAgents.length} agent(s)`);
  if (lostAgents.length > 0) parts.push(`-${lostAgents.length} agent(s)`);

  return parts.length > 0 ? parts.join(", ") : "Minor content shift";
}

function computeOverallConfidence(ir: IRGraph): number {
  if (ir.findings.length === 0) return 0;
  const avgConfidence = ir.findings.reduce((sum, f) => sum + f.confidence, 0) / ir.findings.length;
  return avgConfidence;
}
