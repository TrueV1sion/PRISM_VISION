/**
 * Data Export Renderers (JSON + CSV)
 *
 * Exports the IR Graph as structured data for downstream analysis.
 */

import type { IRGraph } from "@/lib/pipeline/ir-types";
import type { Renderer, RenderOutput } from "./types";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function findingsToCsv(ir: IRGraph): string {
  const header = [
    "Finding ID",
    "Agent",
    "Agent Archetype",
    "Dimension",
    "Statement",
    "Evidence Type",
    "Confidence",
    "Actionability",
    "Novelty",
    "Tags",
    "References",
  ].join(",");

  const rows = ir.findings.map((f) =>
    [
      escapeCsv(f.id),
      escapeCsv(f.agent),
      escapeCsv(f.agentArchetype),
      escapeCsv(f.dimension),
      escapeCsv(f.value),
      escapeCsv(f.evidenceType),
      String(f.confidence),
      String(f.actionabilityScore),
      String(f.noveltyScore),
      escapeCsv(f.tags.join("; ")),
      escapeCsv(f.references.join("; ")),
    ].join(","),
  );

  return [header, ...rows].join("\n");
}

function emergencesToCsv(ir: IRGraph): string {
  const header = [
    "Emergence ID",
    "Insight",
    "Algorithm",
    "Supporting Agents",
    "Novelty",
    "Grounding",
    "Actionability",
    "Depth",
    "Surprise",
    "Why Multi-Agent",
  ].join(",");

  const rows = ir.emergences.map((e) =>
    [
      escapeCsv(e.id),
      escapeCsv(e.insight),
      escapeCsv(e.algorithm),
      escapeCsv(e.supportingAgents.join("; ")),
      String(e.qualityScores.novelty),
      String(e.qualityScores.grounding),
      String(e.qualityScores.actionability),
      String(e.qualityScores.depth),
      String(e.qualityScores.surprise),
      escapeCsv(e.whyMultiAgent),
    ].join(","),
  );

  return [header, ...rows].join("\n");
}

export const jsonExportRenderer: Renderer = {
  format: "data-export-json",
  name: "JSON Export",
  description: "Full IR Graph as structured JSON",

  canRender(_ir: IRGraph): boolean {
    return true;
  },

  async render(ir: IRGraph): Promise<RenderOutput> {
    return {
      format: "data-export-json",
      mimeType: "application/json",
      content: JSON.stringify(ir, null, 2),
      filename: `PRISM-IR-${ir.metadata.runId}.json`,
    };
  },
};

export const csvExportRenderer: Renderer = {
  format: "data-export-csv",
  name: "CSV Export",
  description: "Findings and emergences as CSV tables",

  canRender(ir: IRGraph): boolean {
    return ir.findings.length > 0;
  },

  async render(ir: IRGraph): Promise<RenderOutput> {
    const findings = findingsToCsv(ir);
    const emergences = emergencesToCsv(ir);

    const combined = `=== FINDINGS ===\n${findings}\n\n=== EMERGENCES ===\n${emergences}`;

    return {
      format: "data-export-csv",
      mimeType: "text/csv",
      content: combined,
      filename: `PRISM-Export-${ir.metadata.runId}.csv`,
    };
  },
};
