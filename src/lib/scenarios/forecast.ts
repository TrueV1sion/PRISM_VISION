/**
 * PRISM Scenario Forecast Engine
 *
 * Deploys FUTURIST + domain-relevant agents against a completed scenario's
 * modified IR Graph. These agents extend the scenario forward in time,
 * building scenario trees: optimistic, pessimistic, and most-likely futures.
 *
 * This is a lightweight DEPLOY-only run (~60s, 2 agents) that enriches
 * the scenario's IR Graph with forward-looking intelligence.
 */

import { prisma } from "@/lib/prisma";
import { ARCHETYPE_REGISTRY, type ArchetypeProfile } from "@/lib/pipeline/archetypes";
import { deploy } from "@/lib/pipeline/deploy";
import { MemoryBus } from "@/lib/pipeline/memory-bus";
import type {
  ConstructedAgent,
  AgentResult,
  Blueprint,
  PipelineEvent,
} from "@/lib/pipeline/types";
import type { IRGraph, IREmergence } from "@/lib/pipeline/ir-types";

// ─── Types ──────────────────────────────────────────────────

export interface ForecastResult {
  findings: AgentResult[];
  scenarios: ForecastScenario[];
  computeTimeMs: number;
}

export interface ForecastScenario {
  name: string;
  outlook: "optimistic" | "pessimistic" | "most_likely";
  description: string;
  keyDrivers: string[];
  timeline: string;
  confidence: number;
  agentName: string;
}

// ─── Main Function ──────────────────────────────────────────

/**
 * Run a forecast on a completed scenario by deploying forward-looking agents.
 */
export async function runForecast(scenarioId: string): Promise<ForecastResult> {
  const startTime = Date.now();

  // 1. Load scenario with result
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: {
      result: true,
      levers: true,
      run: {
        select: {
          id: true,
          query: true,
          tier: true,
          agents: {
            select: { name: true, archetype: true, dimension: true },
          },
        },
      },
    },
  });

  if (!scenario) throw new Error(`Scenario ${scenarioId} not found`);
  if (!scenario.result) throw new Error(`Scenario ${scenarioId} has no computed result`);

  const modifiedIR = scenario.result.modifiedIrGraph as unknown as IRGraph;

  // 2. Build context summary for forecast agents
  const contextSummary = buildScenarioContextForForecast(modifiedIR, scenario.run.query);

  // 3. Build MemoryBus with scenario findings for agent context
  const memoryBus = new MemoryBus(scenario.run.query);
  populateBusFromIR(memoryBus, modifiedIR);

  // 4. Construct forecast agents
  const futurist = ARCHETYPE_REGISTRY["FUTURIST"];
  if (!futurist) {
    throw new Error("FUTURIST archetype not found in registry");
  }

  // Pick a domain-relevant archetype based on the run's existing agents
  const domainArchetype = pickDomainArchetype(scenario.run.agents);

  const agents: ConstructedAgent[] = [
    buildForecastAgent(futurist, "Futures & Trends", contextSummary),
    buildForecastAgent(domainArchetype, "Domain Forecast", contextSummary),
  ];

  // 5. Build lightweight blueprint
  const blueprint: Blueprint = {
    query: scenario.run.query,
    tier: "MICRO",
    complexityScore: {
      breadth: 2, depth: 3, interconnection: 2,
      total: 7, urgency: 1.0, adjusted: 7,
      reasoning: "Forecast: temporal projection of scenario implications",
    },
    dimensions: [
      {
        name: "Futures & Trends",
        description: "Identify converging trends and build scenario trees",
        justification: "Forecast",
        dataSources: [],
        lens: "temporal",
        signalMatch: "",
      },
      {
        name: "Domain Forecast",
        description: "Domain-specific forward-looking analysis",
        justification: "Forecast",
        dataSources: [],
        lens: "domain",
        signalMatch: "",
      },
    ],
    agents: agents.map(a => ({
      name: a.name,
      archetype: a.archetype,
      dimension: a.dimension,
      mandate: a.mandate,
      tools: a.tools,
      lens: "",
      bias: "",
    })),
    interconnections: [],
    estimatedTime: "~60s (forecast)",
    ethicalConcerns: [],
  };

  // 6. Deploy forecast agents
  const deployResult = await deploy({
    agents,
    blueprint,
    emitEvent: (event: PipelineEvent) => {
      console.log(`[FORECAST:${scenarioId}] ${event.type}${
        "agentName" in event ? ` (${event.agentName})` : ""
      }`);
    },
    memoryBus,
  });

  // 7. Extract forecast scenarios from agent findings
  const forecastScenarios = extractForecastScenarios(deployResult.agentResults);

  // 8. Merge forecast findings into the scenario result
  await mergeForecastFindings(scenarioId, deployResult.agentResults, forecastScenarios);

  const computeTimeMs = Date.now() - startTime;
  console.log(`[FORECAST:${scenarioId}] Complete in ${computeTimeMs}ms — ${forecastScenarios.length} forecast scenarios generated`);

  return {
    findings: deployResult.agentResults,
    scenarios: forecastScenarios,
    computeTimeMs,
  };
}

// ─── Agent Construction ──────────────────────────────────────

function buildForecastAgent(
  archetype: ArchetypeProfile,
  dimension: string,
  contextSummary: string,
): ConstructedAgent {
  const systemPrompt = `${archetype.promptTemplate}

You are performing a FORECAST analysis on a scenario. Your job is to project the scenario's
implications forward in time, identifying emerging trends, inflection points, and plausible futures.

Build three scenario trees:
1. OPTIMISTIC: Best-case trajectory if current trends continue favorably
2. PESSIMISTIC: Worst-case trajectory if risks materialize
3. MOST LIKELY: The probable path based on current evidence

For each scenario tree:
- Identify the key drivers that determine this outcome
- Estimate a timeline (6 months, 1 year, 3 years, 5 years)
- Rate your confidence in this projection
- Note which findings from the current analysis most support this trajectory`;

  const researchPrompt = `## Forecast Mission

You are a ${archetype.id} agent deployed to forecast the implications of a scenario analysis.
Your lens: ${archetype.lens}
Your analytical bias: ${archetype.bias}

## Scenario Context

${contextSummary}

## Your Task

Project this scenario forward in time. Build three scenario trees:

1. **OPTIMISTIC** — What's the best-case outcome? What needs to go right?
2. **PESSIMISTIC** — What's the worst-case outcome? What risks could materialize?
3. **MOST LIKELY** — What's the probable trajectory based on current evidence?

For each:
- Key drivers and inflection points
- Estimated timeline
- Confidence level
- Supporting evidence from the current analysis

Also identify:
- Weak signals that could shift the trajectory
- Convergence points where multiple trends reinforce each other
- Second-order effects that might not be immediately obvious

Use your available research tools to gather forward-looking intelligence.
When your analysis is complete, call submit_findings with your structured results.`;

  return {
    name: `${archetype.id} Forecaster`,
    archetype: archetype.id,
    dimension,
    mandate: `Forecast scenario implications using ${archetype.lens}`,
    systemPrompt,
    researchPrompt,
    tools: [],
    skills: [],
    color: archetype.id === "FUTURIST" ? "#6366f1" : "#10b981",
    neutralFramingApplied: false,
  };
}

// ─── Domain Archetype Selection ──────────────────────────────

/**
 * Pick the most relevant domain archetype based on the existing agents
 * in the parent run. Falls back to RESEARCHER if no domain match.
 */
function pickDomainArchetype(
  agents: Array<{ name: string; archetype: string; dimension: string }>,
): ArchetypeProfile {
  // Count archetype frequencies, excluding meta/core archetypes
  const domainArchetypes = new Set([
    "FUTURIST", "HISTORIAN", "CUSTOMER_PROXY", "REGULATORY_SCANNER",
    "MARKET_ANALYST", "POLICY_ANALYST", "HEALTH_ECONOMIST",
    "EPIDEMIOLOGIST", "CLINICAL_SPECIALIST",
  ]);

  const counts: Record<string, number> = {};
  for (const agent of agents) {
    if (domainArchetypes.has(agent.archetype) && agent.archetype !== "FUTURIST") {
      counts[agent.archetype] = (counts[agent.archetype] || 0) + 1;
    }
  }

  // Pick the most common domain archetype, or fall back to RESEARCHER
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topArchetype = sorted[0]?.[0];

  if (topArchetype && ARCHETYPE_REGISTRY[topArchetype]) {
    return ARCHETYPE_REGISTRY[topArchetype];
  }

  // Fallback: use RESEARCHER with trend-focused framing
  return ARCHETYPE_REGISTRY["RESEARCHER"]!;
}

// ─── Context Builder ─────────────────────────────────────────

function buildScenarioContextForForecast(ir: IRGraph, query: string): string {
  const sections: string[] = [];

  sections.push(`### Research Question\n${query}`);

  // Key emergences (these are the primary basis for forecasting)
  if (ir.emergences.length > 0) {
    const avgQuality = (scores: IREmergence["qualityScores"]) =>
      (scores.novelty + scores.grounding + scores.actionability + scores.depth + scores.surprise) / 5;
    const topEmergences = ir.emergences
      .sort((a, b) => avgQuality(b.qualityScores) - avgQuality(a.qualityScores))
      .slice(0, 7);
    sections.push(
      `### Key Emergent Insights (${ir.emergences.length} total, showing top 7)\n` +
      topEmergences.map((e, i) =>
        `${i + 1}. **${e.insight}**\n   Why multi-agent: ${e.whyMultiAgent ?? "N/A"}\n   Supporting: ${e.supportingAgents.join(", ")}\n   Quality: ${avgQuality(e.qualityScores).toFixed(1)}/5`
      ).join("\n\n"),
    );
  }

  // Tensions (especially resolved ones define the scenario's direction)
  if (ir.tensions.length > 0) {
    sections.push(
      `### Tensions & Resolutions\n` +
      ir.tensions.map((t, i) =>
        `${i + 1}. **${t.claim}** [${t.status}]${t.resolution ? ` → ${t.resolution}` : ""}`
      ).join("\n"),
    );
  }

  // High-confidence findings
  const highConfFindings = ir.findings
    .filter(f => f.confidence >= 0.7)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15);
  if (highConfFindings.length > 0) {
    sections.push(
      `### High-Confidence Findings (basis for projection)\n` +
      highConfFindings.map((f, i) =>
        `${i + 1}. [${(f.confidence * 100).toFixed(0)}%] ${f.value}`
      ).join("\n"),
    );
  }

  // Gaps (these represent uncertainty in the forecast)
  if (ir.gaps.length > 0) {
    sections.push(
      `### Known Gaps (sources of uncertainty)\n` +
      ir.gaps.map((g, i) =>
        `${i + 1}. ${g.title} — ${g.gapType}, ${g.priority} priority${g.researchable ? " (researchable)" : ""}`
      ).join("\n"),
    );
  }

  return sections.join("\n\n");
}

// ─── Forecast Extraction ─────────────────────────────────────

function extractForecastScenarios(agentResults: AgentResult[]): ForecastScenario[] {
  const scenarios: ForecastScenario[] = [];

  for (const result of agentResults) {
    // Try to classify findings into forecast categories
    for (const finding of result.findings) {
      const lower = finding.statement.toLowerCase();
      const tags = finding.tags.map(t => t.toLowerCase());

      let outlook: ForecastScenario["outlook"] = "most_likely";
      if (
        lower.includes("optimistic") || lower.includes("best-case") ||
        lower.includes("upside") || lower.includes("favorable") ||
        tags.includes("optimistic")
      ) {
        outlook = "optimistic";
      } else if (
        lower.includes("pessimistic") || lower.includes("worst-case") ||
        lower.includes("downside") || lower.includes("risk") ||
        tags.includes("pessimistic")
      ) {
        outlook = "pessimistic";
      }

      // Map confidence level to numeric
      const confidence =
        finding.confidence === "HIGH" ? 0.8 :
        finding.confidence === "MEDIUM" ? 0.5 : 0.3;

      // Extract timeline hints
      const timelineMatch = finding.statement.match(
        /(\d+)\s*(month|year|quarter|week)/i,
      );
      const timeline = timelineMatch
        ? `~${timelineMatch[1]} ${timelineMatch[2]}s`
        : "Medium-term (1-3 years)";

      scenarios.push({
        name: finding.statement.slice(0, 100),
        outlook,
        description: finding.evidence,
        keyDrivers: finding.tags,
        timeline,
        confidence,
        agentName: result.agentName,
      });
    }
  }

  return scenarios;
}

// ─── MemoryBus Population ────────────────────────────────────

function populateBusFromIR(bus: MemoryBus, ir: IRGraph): void {
  for (const finding of ir.findings.slice(0, 50)) {
    bus.writeToBlackboard({
      agent: finding.agent,
      key: `${finding.dimension.toLowerCase().replace(/\s+/g, "-")}/finding`,
      value: finding.value,
      confidence: finding.confidence,
      evidenceType: "direct",
      tags: [finding.dimension.toLowerCase()],
      references: finding.references.slice(0, 3),
    });
  }
}

// ─── Result Merging ──────────────────────────────────────────

async function mergeForecastFindings(
  scenarioId: string,
  agentResults: AgentResult[],
  forecastScenarios: ForecastScenario[],
): Promise<void> {
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { result: true },
  });

  if (!scenario?.result) return;

  const existingSensitivity = scenario.result.sensitivityMap as unknown as unknown[];
  const forecastData = {
    type: "forecast" as const,
    agentResults: agentResults.map(r => ({
      agentName: r.agentName,
      archetype: r.archetype,
      findingCount: r.findings.length,
    })),
    scenarios: forecastScenarios.map(s => ({
      name: s.name,
      outlook: s.outlook,
      timeline: s.timeline,
      confidence: s.confidence,
    })),
    totalScenarios: forecastScenarios.length,
    outlookBreakdown: {
      optimistic: forecastScenarios.filter(s => s.outlook === "optimistic").length,
      pessimistic: forecastScenarios.filter(s => s.outlook === "pessimistic").length,
      mostLikely: forecastScenarios.filter(s => s.outlook === "most_likely").length,
    },
  };

  await prisma.scenarioResult.update({
    where: { scenarioId },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sensitivityMap: [...existingSensitivity, forecastData] as any,
    },
  });
}
