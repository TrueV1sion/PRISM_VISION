/**
 * PRISM Data Room Package Generator
 *
 * Generates an M&A-style due diligence data room as a ZIP archive containing:
 * 1. Executive Memo (HTML) — strategic summary
 * 2. Full IR Graph (JSON) — complete structured intelligence
 * 3. Findings Report (CSV) — flattened findings table
 * 4. Emergence Report (CSV) — emergent insights with quality scores
 * 5. Source Appendix (text) — all sources by tier with verification status
 * 6. Methodology Document (text) — agent roster, tools used, quality grades
 * 7. README (text) — data room index and navigation guide
 *
 * Uses `archiver` for streaming ZIP construction.
 */

import archiver from "archiver";
import type { IRGraph } from "@/lib/pipeline/ir-types";
import type { Renderer, RenderOutput } from "./types";
import { executiveMemoRenderer } from "./executive-memo";
import { jsonExportRenderer, csvExportRenderer } from "./data-export";

async function renderDataRoom(
  ir: IRGraph,
  options?: Record<string, unknown>,
): Promise<RenderOutput> {
  const query = (options?.query as string) ?? "intelligence-report";
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 50);

  // Generate all component outputs in parallel
  const [memoOutput, jsonOutput, csvOutput] = await Promise.all([
    executiveMemoRenderer.render(ir, options),
    jsonExportRenderer.render(ir, options),
    csvExportRenderer.render(ir, options),
  ]);

  // Build additional documents
  const sourceAppendix = buildSourceAppendix(ir);
  const methodology = buildMethodologyDoc(ir, options);
  const emergenceCsv = buildEmergenceCsv(ir);
  const readme = buildReadme(slug, ir);

  // Create ZIP archive in memory
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    // Add files to the archive
    archive.append(memoOutput.content as string, {
      name: `${slug}/01-executive-memo.html`,
    });
    archive.append(jsonOutput.content as string, {
      name: `${slug}/02-ir-graph.json`,
    });
    archive.append(csvOutput.content as string, {
      name: `${slug}/03-findings.csv`,
    });
    archive.append(emergenceCsv, {
      name: `${slug}/04-emergences.csv`,
    });
    archive.append(sourceAppendix, {
      name: `${slug}/05-source-appendix.txt`,
    });
    archive.append(methodology, {
      name: `${slug}/06-methodology.txt`,
    });
    archive.append(readme, {
      name: `${slug}/README.txt`,
    });

    archive.finalize();
  });

  return {
    format: "data-room",
    mimeType: "application/zip",
    content: buffer,
    filename: `prism-data-room-${slug}.zip`,
  };
}

// ─── Source Appendix ──────────────────────────────────────────

function buildSourceAppendix(ir: IRGraph): string {
  const lines: string[] = [
    "═══════════════════════════════════════════════════",
    "  PRISM Strategic Intelligence — Source Appendix",
    "═══════════════════════════════════════════════════",
    "",
    `Total Findings: ${ir.findings.length}`,
    `Date: ${new Date().toISOString().split("T")[0]}`,
    "",
  ];

  // Group findings by evidence type
  const byType: Record<string, typeof ir.findings> = {};
  for (const f of ir.findings) {
    const type = f.evidenceType ?? "unknown";
    (byType[type] ??= []).push(f);
  }

  for (const [type, findings] of Object.entries(byType)) {
    lines.push(`─── ${type.toUpperCase()} EVIDENCE (${findings.length}) ───`);
    lines.push("");
    for (const f of findings) {
      const verified = f.sourceVerified ? " ✓ VERIFIED" : "";
      lines.push(`  [${(f.confidence * 100).toFixed(0)}%]${verified} ${f.value}`);
      lines.push(`    Agent: ${f.agent} (${f.agentArchetype})`);
      lines.push(`    Dimension: ${f.dimension}`);
      if (f.references.length > 0) {
        lines.push(`    References: ${f.references.join("; ")}`);
      }
      lines.push("");
    }
  }

  // Gaps section
  if (ir.gaps.length > 0) {
    lines.push("─── KNOWN GAPS ───");
    lines.push("");
    for (const g of ir.gaps) {
      lines.push(`  ${g.title}`);
      lines.push(`    Type: ${g.gapType} | Priority: ${g.priority} | Researchable: ${g.researchable}`);
      lines.push(`    ${g.description}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ─── Methodology Document ─────────────────────────────────────

function buildMethodologyDoc(ir: IRGraph, options?: Record<string, unknown>): string {
  const query = (options?.query as string) ?? "N/A";

  // Deduplicate agents
  const agents = new Map<string, { archetype: string; dimension: string; findingCount: number }>();
  for (const f of ir.findings) {
    const existing = agents.get(f.agent);
    if (existing) {
      existing.findingCount++;
    } else {
      agents.set(f.agent, {
        archetype: f.agentArchetype,
        dimension: f.dimension,
        findingCount: 1,
      });
    }
  }

  const lines: string[] = [
    "═══════════════════════════════════════════════════",
    "  PRISM Strategic Intelligence — Methodology",
    "═══════════════════════════════════════════════════",
    "",
    `Research Question: ${query}`,
    `Date: ${new Date().toISOString().split("T")[0]}`,
    `Platform: PRISM Multi-Agent Intelligence Platform`,
    "",
    "─── AGENT ROSTER ───",
    "",
  ];

  for (const [name, info] of agents) {
    lines.push(`  ${name}`);
    lines.push(`    Archetype: ${info.archetype}`);
    lines.push(`    Dimension: ${info.dimension}`);
    lines.push(`    Findings: ${info.findingCount}`);
    lines.push("");
  }

  lines.push("─── INTELLIGENCE METRICS ───");
  lines.push("");
  lines.push(`  Total Findings: ${ir.findings.length}`);
  lines.push(`  Emergent Insights: ${ir.emergences.length}`);
  lines.push(`  Tensions Detected: ${ir.tensions.length}`);
  lines.push(`  Knowledge Gaps: ${ir.gaps.length}`);
  lines.push(`  Agent Count: ${agents.size}`);
  lines.push("");

  // Confidence distribution
  const highConf = ir.findings.filter(f => f.confidence >= 0.7).length;
  const medConf = ir.findings.filter(f => f.confidence >= 0.4 && f.confidence < 0.7).length;
  const lowConf = ir.findings.filter(f => f.confidence < 0.4).length;
  lines.push(`  Confidence Distribution:`);
  lines.push(`    HIGH (≥70%):   ${highConf} (${((highConf / Math.max(1, ir.findings.length)) * 100).toFixed(0)}%)`);
  lines.push(`    MEDIUM (40-69%): ${medConf} (${((medConf / Math.max(1, ir.findings.length)) * 100).toFixed(0)}%)`);
  lines.push(`    LOW (<40%):    ${lowConf} (${((lowConf / Math.max(1, ir.findings.length)) * 100).toFixed(0)}%)`);
  lines.push("");

  // Emergence quality
  if (ir.emergences.length > 0) {
    lines.push("─── EMERGENCE QUALITY ───");
    lines.push("");
    for (const e of ir.emergences) {
      const s = e.qualityScores;
      const avg = (s.novelty + s.grounding + s.actionability + s.depth + s.surprise) / 5;
      lines.push(`  "${e.insight.slice(0, 80)}${e.insight.length > 80 ? "..." : ""}"`);
      lines.push(`    Algorithm: ${e.algorithm.replace(/_/g, " ")}`);
      lines.push(`    Quality: ${avg.toFixed(1)}/5 (N:${s.novelty} G:${s.grounding} A:${s.actionability} D:${s.depth} S:${s.surprise})`);
      lines.push(`    Supporting agents: ${e.supportingAgents.join(", ")}`);
      lines.push("");
    }
  }

  lines.push("─── DISCLAIMER ───");
  lines.push("");
  lines.push("  This intelligence product was generated by the PRISM multi-agent");
  lines.push("  analysis platform. Findings represent synthesized outputs from");
  lines.push("  multiple AI research agents and should be validated by domain experts");
  lines.push("  before use in decision-making. Source tier ratings indicate the");
  lines.push("  provenance of underlying data, not its accuracy.");
  lines.push("");

  return lines.join("\n");
}

// ─── Emergence CSV ────────────────────────────────────────────

function buildEmergenceCsv(ir: IRGraph): string {
  const headers = [
    "ID",
    "Insight",
    "Algorithm",
    "Supporting Agents",
    "Novelty",
    "Grounding",
    "Actionability",
    "Depth",
    "Surprise",
    "Overall Quality",
    "Why Multi-Agent",
  ];

  const rows = ir.emergences.map(e => {
    const s = e.qualityScores;
    const avg = (s.novelty + s.grounding + s.actionability + s.depth + s.surprise) / 5;
    return [
      e.id,
      `"${e.insight.replace(/"/g, '""')}"`,
      e.algorithm,
      `"${e.supportingAgents.join("; ")}"`,
      s.novelty,
      s.grounding,
      s.actionability,
      s.depth,
      s.surprise,
      avg.toFixed(2),
      `"${(e.whyMultiAgent ?? "").replace(/"/g, '""')}"`,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

// ─── README ───────────────────────────────────────────────────

function buildReadme(slug: string, ir: IRGraph): string {
  return `PRISM Strategic Intelligence — Data Room
═════════════════════════════════════════

This data room contains the complete intelligence product for:
${slug.replace(/-/g, " ")}

Contents:
─────────
01-executive-memo.html    Strategic summary (open in any browser)
02-ir-graph.json          Full structured intelligence graph
03-findings.csv           Flattened findings table (open in Excel)
04-emergences.csv         Emergent insights with quality scores
05-source-appendix.txt    All sources organized by evidence type
06-methodology.txt        Agent roster, metrics, and quality analysis

Quick Stats:
────────────
Findings:     ${ir.findings.length}
Emergences:   ${ir.emergences.length}
Tensions:     ${ir.tensions.length}
Gaps:         ${ir.gaps.length}

Generated: ${new Date().toISOString()}
Platform:  PRISM Multi-Agent Strategic Intelligence
`;
}

// ─── Renderer Registration ────────────────────────────────────

export const dataRoomRenderer: Renderer = {
  format: "data-room",
  name: "Data Room (ZIP)",
  description: "M&A-style due diligence package: memo + data + sources + methodology",
  canRender(ir: IRGraph): boolean {
    return ir.findings.length >= 2 && ir.emergences.length >= 1;
  },
  render: renderDataRoom,
};
