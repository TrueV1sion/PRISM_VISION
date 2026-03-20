/**
 * PRISM Scenario IR Builder
 *
 * Builds a modified IR Graph from re-synthesis results.
 * The baseline IR Graph provides the structural scaffold (findings, agents, sources),
 * and the new synthesis result provides updated emergences, tensions, and layers.
 */

import type { IRGraph } from "@/lib/pipeline/ir-types";
import type { SynthesisResult } from "@/lib/pipeline/types";
import type { MemoryBus } from "@/lib/pipeline/memory-bus";

/**
 * Build a modified IR Graph by overlaying new synthesis results
 * onto the baseline structure.
 */
export function buildIRGraph(
  baseline: IRGraph,
  synthResult: SynthesisResult,
  forkedBus: MemoryBus,
): IRGraph {
  // Start with a deep copy of the baseline
  const modified: IRGraph = JSON.parse(JSON.stringify(baseline));

  // Update metadata to reflect scenario computation
  modified.metadata = {
    ...modified.metadata,
    timestamp: new Date().toISOString(),
    pyramidLayersApplied: synthResult.layers.map(l => l.name),
  };

  // Merge findings from the forked bus (may include scenario-injected findings)
  const busIR = forkedBus.exportIR();
  if (busIR) {
    // Keep all baseline findings plus any scenario-injected ones
    const baselineIds = new Set(baseline.findings.map(f => f.id));
    const scenarioFindings = busIR.findings.filter(f => !baselineIds.has(f.id));
    modified.findings = [...modified.findings, ...scenarioFindings];
  }

  // Replace emergences with new synthesis results
  modified.emergences = synthResult.emergentInsights.map((insight, i) => ({
    id: `scenario-emergence-${i}`,
    insight: insight.insight,
    algorithm: insight.algorithm,
    supportingAgents: insight.supportingAgents,
    evidenceSources: insight.evidenceSources,
    constituentFindingIds: [] as string[],
    qualityScores: insight.qualityScores,
    whyMultiAgent: insight.whyMultiAgent,
  }));

  // Replace tensions with new synthesis results
  modified.tensions = synthResult.tensionPoints.map((tp, i) => ({
    id: `scenario-tension-${i}`,
    registeredBy: "scenario-synthesizer",
    timestamp: new Date().toISOString(),
    status: tp.resolution ? "resolved" as const : "open" as const,
    claim: tp.tension,
    positions: [
      {
        agent: tp.sideA.agents[0] ?? "unknown",
        position: tp.sideA.position,
        evidence: Array.isArray(tp.sideA.evidence) ? tp.sideA.evidence.join("; ") : String(tp.sideA.evidence ?? ""),
        confidence: 0.7,
      },
      {
        agent: tp.sideB.agents[0] ?? "unknown",
        position: tp.sideB.position,
        evidence: Array.isArray(tp.sideB.evidence) ? tp.sideB.evidence.join("; ") : String(tp.sideB.evidence ?? ""),
        confidence: 0.7,
      },
    ],
    resolution: tp.resolution || null,
    resolutionStrategy: undefined,
    conflictType: tp.conflictType,
  }));

  // Update gaps from gap layer
  const gapLayer = synthResult.layers.find(l => l.name === "gap");
  if (gapLayer) {
    modified.gaps = gapLayer.insights.map((insight, i) => ({
      id: `scenario-gap-${i}`,
      title: insight.length > 100 ? insight.slice(0, 100) + "…" : insight,
      description: insight,
      gapType: "structural" as const,
      source: "synthesis_layer" as const,
      priority: "medium" as const,
      researchable: true,
    }));
  }

  // Update quality scores if available
  if (modified.quality) {
    modified.quality.overallScore = Math.max(0, Math.min(100,
      modified.quality.overallScore + (synthResult.overallConfidence === "HIGH" ? 5 : synthResult.overallConfidence === "LOW" ? -10 : 0)
    ));
  }

  return modified;
}
