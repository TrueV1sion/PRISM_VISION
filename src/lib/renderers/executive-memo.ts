/**
 * Executive Memo Renderer
 *
 * Generates a 2-3 page McKinsey/BCG-style structured intelligence memo
 * from the IR Graph. Optimized for print and quick executive reading.
 */

import type { IRGraph, IRFinding, IREmergence, IRTension } from "@/lib/pipeline/ir-types";
import type { Renderer, RenderOutput } from "./types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function confidenceBadge(confidence: number): string {
  const label = confidence >= 0.8 ? "HIGH" : confidence >= 0.5 ? "MEDIUM" : "LOW";
  const color = confidence >= 0.8 ? "#3ABFA0" : confidence >= 0.5 ? "#538BCD" : "#E8975E";
  return `<span style="display:inline-block;padding:1px 8px;border-radius:3px;font-size:10px;font-weight:600;letter-spacing:0.05em;color:${color};border:1px solid ${color}40">${label}</span>`;
}

function tierBadge(tier: string): string {
  const colors: Record<string, string> = {
    PRIMARY: "#3ABFA0",
    SECONDARY: "#538BCD",
    TERTIARY: "#9B8EC4",
  };
  const color = colors[tier] ?? "#888";
  return `<span style="font-size:9px;font-weight:600;color:${color};letter-spacing:0.06em">${tier}</span>`;
}

function qualityRadar(emergence: IREmergence): string {
  const { novelty, grounding, actionability, depth, surprise } = emergence.qualityScores;
  const bars = [
    { label: "Nov", value: novelty },
    { label: "Grd", value: grounding },
    { label: "Act", value: actionability },
    { label: "Dep", value: depth },
    { label: "Sur", value: surprise },
  ];
  return bars
    .map(
      (b) =>
        `<span style="font-size:9px;color:#A0A8C0">${b.label}</span>&nbsp;<span style="font-size:9px;font-weight:600;color:#F0F2F8">${b.value}</span>`,
    )
    .join("&nbsp;&nbsp;");
}

function renderExecutiveSummary(ir: IRGraph): string {
  // Top emergences by average quality score
  const rankedEmergences = [...ir.emergences]
    .map((e) => ({
      ...e,
      avgScore:
        (e.qualityScores.novelty +
          e.qualityScores.grounding +
          e.qualityScores.actionability +
          e.qualityScores.depth +
          e.qualityScores.surprise) /
        5,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);

  // Top findings by confidence
  const topFindings = [...ir.findings]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  const bullets = [
    ...rankedEmergences.map(
      (e) => `<li>${escapeHtml(e.insight)} ${confidenceBadge(e.avgScore / 5)}</li>`,
    ),
    ...topFindings
      .filter((f) => !rankedEmergences.some((e) => e.insight.includes(f.key)))
      .slice(0, 2)
      .map((f) => `<li>${escapeHtml(f.value)} ${confidenceBadge(f.confidence)}</li>`),
  ].slice(0, 5);

  return `
    <section class="memo-section">
      <h2>Executive Summary</h2>
      <ul class="summary-bullets">${bullets.join("\n        ")}</ul>
    </section>`;
}

function renderKeyFindings(ir: IRGraph): string {
  // Group findings by dimension
  const byDimension = new Map<string, IRFinding[]>();
  for (const f of ir.findings) {
    const group = byDimension.get(f.dimension) ?? [];
    group.push(f);
    byDimension.set(f.dimension, group);
  }

  const sections: string[] = [];
  for (const [dimension, findings] of byDimension) {
    const sorted = [...findings]
      .sort((a, b) => b.actionabilityScore - a.actionabilityScore || b.confidence - a.confidence)
      .slice(0, 5);

    const rows = sorted
      .map(
        (f) => `
        <tr>
          <td>${escapeHtml(f.value)}</td>
          <td class="meta">${confidenceBadge(f.confidence)}</td>
          <td class="meta">${escapeHtml(f.agent)}</td>
        </tr>`,
      )
      .join("");

    sections.push(`
      <div class="dimension-group">
        <h3>${escapeHtml(dimension)}</h3>
        <table class="findings-table">
          <thead><tr><th>Finding</th><th>Confidence</th><th>Agent</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`);
  }

  return `
    <section class="memo-section">
      <h2>Key Findings</h2>
      ${sections.join("\n")}
    </section>`;
}

function renderEmergentInsights(ir: IRGraph): string {
  if (ir.emergences.length === 0) return "";

  const ranked = [...ir.emergences]
    .sort(
      (a, b) =>
        b.qualityScores.actionability - a.qualityScores.actionability ||
        b.qualityScores.novelty - a.qualityScores.novelty,
    )
    .slice(0, 6);

  const cards = ranked
    .map(
      (e) => `
      <div class="emergence-card">
        <div class="emergence-insight">${escapeHtml(e.insight)}</div>
        <div class="emergence-why">${escapeHtml(e.whyMultiAgent)}</div>
        <div class="emergence-meta">
          <span class="emergence-algo">${escapeHtml(e.algorithm.replace(/_/g, " "))}</span>
          ${qualityRadar(e)}
        </div>
      </div>`,
    )
    .join("\n");

  return `
    <section class="memo-section">
      <h2>Emergent Insights</h2>
      <p class="section-note">These insights emerged only through multi-agent cross-analysis and would not be visible from any single research stream.</p>
      ${cards}
    </section>`;
}

function renderTensions(ir: IRGraph): string {
  if (ir.tensions.length === 0) return "";

  const tensions = ir.tensions.slice(0, 5);
  const items = tensions
    .map((t) => {
      const positions = t.positions
        .map(
          (p) =>
            `<div class="position">
              <span class="position-agent">${escapeHtml(p.agent)}</span>: ${escapeHtml(p.position)}
              ${confidenceBadge(p.confidence)}
            </div>`,
        )
        .join("");

      const resolution = t.resolution
        ? `<div class="resolution"><strong>Resolution:</strong> ${escapeHtml(t.resolution)}</div>`
        : `<div class="resolution unresolved">Unresolved — ${escapeHtml(t.status)}</div>`;

      return `
        <div class="tension-item">
          <div class="tension-claim">${escapeHtml(t.claim)}</div>
          <div class="tension-positions">${positions}</div>
          ${resolution}
        </div>`;
    })
    .join("");

  return `
    <section class="memo-section">
      <h2>Risk &amp; Tension Analysis</h2>
      ${items}
    </section>`;
}

function renderRecommendations(ir: IRGraph): string {
  const actionableFindings = [...ir.findings]
    .filter((f) => f.actionabilityScore >= 4)
    .sort((a, b) => b.actionabilityScore - a.actionabilityScore)
    .slice(0, 5);

  const researchableGaps = ir.gaps
    .filter((g) => g.researchable)
    .sort((a, b) => {
      const prio = { high: 3, medium: 2, low: 1 };
      return (prio[b.priority] ?? 0) - (prio[a.priority] ?? 0);
    })
    .slice(0, 3);

  if (actionableFindings.length === 0 && researchableGaps.length === 0) return "";

  const items: string[] = [];
  for (const f of actionableFindings) {
    items.push(`<li><strong>Act on:</strong> ${escapeHtml(f.value)} <span class="rec-source">(${escapeHtml(f.agent)})</span></li>`);
  }
  for (const g of researchableGaps) {
    items.push(`<li><strong>Investigate:</strong> ${escapeHtml(g.description)} <span class="rec-priority">${g.priority.toUpperCase()}</span></li>`);
  }

  return `
    <section class="memo-section">
      <h2>Recommendations</h2>
      <ol class="recommendations-list">${items.join("\n        ")}</ol>
    </section>`;
}

function renderMethodology(ir: IRGraph): string {
  const agentCount = ir.agents.length;
  const findingCount = ir.findings.length;
  const emergenceCount = ir.emergences.length;
  const tensionCount = ir.tensions.length;
  const gapCount = ir.gaps.length;
  const sourceCount = ir.sources.length;

  const tierCounts = { PRIMARY: 0, SECONDARY: 0, TERTIARY: 0 };
  for (const s of ir.sources) {
    tierCounts[s.sourceTier] = (tierCounts[s.sourceTier] ?? 0) + 1;
  }

  const grade = ir.quality?.grade ?? "N/A";
  const score = ir.quality?.overallScore != null ? `${Math.round(ir.quality.overallScore * 100)}%` : "N/A";

  return `
    <section class="memo-section methodology">
      <h2>Methodology &amp; Provenance</h2>
      <div class="method-grid">
        <div class="method-stat"><span class="method-value">${agentCount}</span><span class="method-label">Agents</span></div>
        <div class="method-stat"><span class="method-value">${findingCount}</span><span class="method-label">Findings</span></div>
        <div class="method-stat"><span class="method-value">${emergenceCount}</span><span class="method-label">Emergences</span></div>
        <div class="method-stat"><span class="method-value">${tensionCount}</span><span class="method-label">Tensions</span></div>
        <div class="method-stat"><span class="method-value">${gapCount}</span><span class="method-label">Gaps</span></div>
        <div class="method-stat"><span class="method-value">${sourceCount}</span><span class="method-label">Sources</span></div>
      </div>
      <div class="method-quality">
        Quality Grade: <strong>${grade}</strong> (${score}) &nbsp;|&nbsp;
        Sources: ${tierBadge("PRIMARY")} ${tierCounts.PRIMARY} &nbsp;
        ${tierBadge("SECONDARY")} ${tierCounts.SECONDARY} &nbsp;
        ${tierBadge("TERTIARY")} ${tierCounts.TERTIARY}
      </div>
    </section>`;
}

function renderMemoHTML(ir: IRGraph, query: string): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const tier = ir.metadata.investigationTier;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PRISM Intelligence Memo</title>
  <style>
    :root {
      --bg: #0A0E1A;
      --surface: #111827;
      --surface-elevated: #1A2236;
      --border: rgba(255,255,255,0.08);
      --text: #F0F2F8;
      --text-secondary: #A0A8C0;
      --text-tertiary: #6B7394;
      --accent: #538BCD;
      --accent-bright: #59DDFD;
      --jade: #3ABFA0;
      --violet: #9B8EC4;
      --warning: #E8975E;
      --error: #E8636F;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.65;
      font-size: 13px;
      padding: 48px 56px;
      max-width: 900px;
      margin: 0 auto;
    }
    @media print {
      body { background: white; color: #1a1a1a; padding: 24px; font-size: 11px; }
      :root { --text: #1a1a1a; --text-secondary: #555; --text-tertiary: #888; --surface: #f5f5f5; --surface-elevated: #eee; --border: #ddd; --accent: #2563eb; }
      .memo-header { border-bottom-color: #ddd; }
      .memo-section { break-inside: avoid; }
    }

    .memo-header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .memo-header .brand {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15em;
      color: var(--accent-bright);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .memo-header h1 {
      font-size: 22px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--text);
      margin-bottom: 8px;
    }
    .memo-header .meta {
      font-size: 11px;
      color: var(--text-tertiary);
    }
    .memo-header .meta span { margin-right: 16px; }
    .memo-header .classification {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--accent);
      border: 1px solid var(--accent);
      margin-top: 8px;
    }

    .memo-section {
      margin-bottom: 28px;
    }
    .memo-section h2 {
      font-size: 14px;
      font-weight: 700;
      color: var(--accent-bright);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
      margin-bottom: 14px;
    }
    .section-note {
      font-size: 11px;
      font-style: italic;
      color: var(--text-tertiary);
      margin-bottom: 12px;
    }

    .summary-bullets { list-style: none; padding: 0; }
    .summary-bullets li {
      padding: 8px 12px;
      border-left: 3px solid var(--accent);
      margin-bottom: 8px;
      background: var(--surface);
      border-radius: 0 4px 4px 0;
    }

    .dimension-group { margin-bottom: 16px; }
    .dimension-group h3 {
      font-size: 12px;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 6px;
    }
    .findings-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .findings-table th {
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 4px 8px;
      border-bottom: 1px solid var(--border);
    }
    .findings-table td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    .findings-table td.meta { white-space: nowrap; text-align: center; }

    .emergence-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--violet);
      border-radius: 4px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .emergence-insight { font-weight: 500; margin-bottom: 6px; }
    .emergence-why { font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; }
    .emergence-meta { font-size: 10px; color: var(--text-tertiary); }
    .emergence-algo {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      background: var(--surface-elevated);
      font-weight: 600;
      text-transform: capitalize;
      margin-right: 8px;
    }

    .tension-item {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .tension-claim { font-weight: 600; margin-bottom: 8px; }
    .tension-positions { margin-bottom: 8px; }
    .position {
      font-size: 12px;
      padding: 4px 0;
      border-bottom: 1px solid var(--border);
    }
    .position:last-child { border-bottom: none; }
    .position-agent { font-weight: 600; color: var(--accent); }
    .resolution { font-size: 11px; color: var(--jade); }
    .resolution.unresolved { color: var(--warning); }

    .recommendations-list { padding-left: 20px; }
    .recommendations-list li { margin-bottom: 8px; }
    .rec-source { font-size: 11px; color: var(--text-tertiary); }
    .rec-priority {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      background: var(--warning);
      color: var(--bg);
    }

    .methodology { border-top: 1px solid var(--border); padding-top: 20px; }
    .method-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      margin-bottom: 12px;
    }
    .method-stat { text-align: center; }
    .method-value { display: block; font-size: 20px; font-weight: 700; color: var(--accent-bright); }
    .method-label { display: block; font-size: 9px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; }
    .method-quality { font-size: 11px; color: var(--text-secondary); }

    .memo-footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      font-size: 10px;
      color: var(--text-tertiary);
      text-align: center;
    }
  </style>
</head>
<body>
  <header class="memo-header">
    <div class="brand">PRISM Intelligence</div>
    <h1>${escapeHtml(query)}</h1>
    <div class="meta">
      <span>${date}</span>
      <span>Tier: ${escapeHtml(tier)}</span>
      <span>${ir.agents.length} agents &middot; ${ir.findings.length} findings &middot; ${ir.emergences.length} emergences</span>
    </div>
    <div class="classification">STRATEGIC INTELLIGENCE MEMO</div>
  </header>

  ${renderExecutiveSummary(ir)}
  ${renderKeyFindings(ir)}
  ${renderEmergentInsights(ir)}
  ${renderTensions(ir)}
  ${renderRecommendations(ir)}
  ${renderMethodology(ir)}

  <footer class="memo-footer">
    Generated by PRISM Strategic Intelligence Platform &middot; ${date} &middot; Multi-agent analysis with ${ir.agents.length} specialized agents
  </footer>
</body>
</html>`;
}

export const executiveMemoRenderer: Renderer = {
  format: "executive-memo",
  name: "Executive Memo",
  description: "2-3 page McKinsey-style structured intelligence memo optimized for executive reading",

  canRender(ir: IRGraph): boolean {
    return ir.findings.length > 0;
  },

  async render(ir: IRGraph, options?: Record<string, unknown>): Promise<RenderOutput> {
    const query = (options?.query as string) ?? ir.metadata.runId;
    const html = renderMemoHTML(ir, query);
    return {
      format: "executive-memo",
      mimeType: "text/html",
      content: html,
      filename: "PRISM-Executive-Memo.html",
    };
  },
};
