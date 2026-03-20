/**
 * PRISM Scenario Stress-Test Engine
 *
 * Deploys RED_TEAM + DEVIL'S_ADVOCATE agents against a completed scenario's
 * modified IR Graph. These agents probe weaknesses, counter-arguments, and
 * vulnerabilities in the scenario's assumptions and conclusions.
 *
 * This is a lightweight DEPLOY-only run (~60s, 2 agents) that enriches
 * the scenario's IR Graph with adversarial findings.
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
import { diffIRGraphs } from "./diff";

// ─── Types ──────────────────────────────────────────────────

export interface StressTestResult {
  findings: AgentResult[];
  vulnerabilities: StressTestVulnerability[];
  computeTimeMs: number;
}

export interface StressTestVulnerability {
  agentName: string;
  statement: string;
  evidence: string;
  severity: "critical" | "high" | "medium" | "low";
  targetType: "emergence" | "tension" | "finding" | "assumption" | "general";
  targetId?: string;
}

// ─── Main Function ──────────────────────────────────────────

/**
 * Run a stress-test on a completed scenario by deploying adversarial agents.
 */
export async function runStressTest(scenarioId: string): Promise<StressTestResult> {
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

  // 2. Build context summary from the scenario's IR Graph
  const contextSummary = buildScenarioContextForStressTest(modifiedIR, scenario.run.query);

  // 3. Build MemoryBus with scenario findings for agent context
  const memoryBus = new MemoryBus(scenario.run.query);
  populateBusFromIR(memoryBus, modifiedIR);

  // 4. Construct adversarial agents
  const redTeam = ARCHETYPE_REGISTRY["RED_TEAM"];
  const devilsAdvocate = ARCHETYPE_REGISTRY["DEVILS_ADVOCATE"];

  if (!redTeam || !devilsAdvocate) {
    throw new Error("RED_TEAM or DEVILS_ADVOCATE archetype not found in registry");
  }

  const agents: ConstructedAgent[] = [
    buildStressTestAgent(redTeam, "Adversarial Analysis", contextSummary),
    buildStressTestAgent(devilsAdvocate, "Counter-Argument Analysis", contextSummary),
  ];

  // 5. Build lightweight blueprint
  const blueprint: Blueprint = {
    query: scenario.run.query,
    tier: "MICRO",
    complexityScore: {
      breadth: 2, depth: 3, interconnection: 2,
      total: 7, urgency: 1.0, adjusted: 7,
      reasoning: "Stress-test: adversarial probing of scenario assumptions",
    },
    dimensions: [
      {
        name: "Adversarial Analysis",
        description: "Identify vulnerabilities and weaknesses in scenario conclusions",
        justification: "Stress-test",
        dataSources: [],
        lens: "adversarial",
        signalMatch: "",
      },
      {
        name: "Counter-Argument Analysis",
        description: "Construct strongest counter-arguments to scenario claims",
        justification: "Stress-test",
        dataSources: [],
        lens: "contrarian",
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
    estimatedTime: "~60s (stress-test)",
    ethicalConcerns: [],
  };

  // 6. Deploy adversarial agents
  const deployResult = await deploy({
    agents,
    blueprint,
    emitEvent: (event: PipelineEvent) => {
      console.log(`[STRESS-TEST:${scenarioId}] ${event.type}${
        "agentName" in event ? ` (${event.agentName})` : ""
      }`);
    },
    memoryBus,
  });

  // 7. Extract vulnerabilities from agent findings
  const vulnerabilities = extractVulnerabilities(deployResult.agentResults, modifiedIR);

  // 8. Merge stress-test findings into the scenario result
  await mergeStressTestFindings(scenarioId, deployResult.agentResults, vulnerabilities);

  const computeTimeMs = Date.now() - startTime;
  console.log(`[STRESS-TEST:${scenarioId}] Complete in ${computeTimeMs}ms — ${vulnerabilities.length} vulnerabilities found`);

  return {
    findings: deployResult.agentResults,
    vulnerabilities,
    computeTimeMs,
  };
}

// ─── Agent Construction ──────────────────────────────────────

function buildStressTestAgent(
  archetype: ArchetypeProfile,
  dimension: string,
  contextSummary: string,
): ConstructedAgent {
  const systemPrompt = `${archetype.promptTemplate}

You are performing a STRESS TEST on a scenario analysis. Your job is to find weaknesses,
vulnerabilities, counter-arguments, and blind spots in the scenario's conclusions.

Be specific: reference particular findings, emergences, or tensions by name when identifying weaknesses.
Rate each vulnerability by severity: CRITICAL, HIGH, MEDIUM, or LOW.

Focus on:
1. Assumptions that lack sufficient evidence
2. Findings that could be interpreted differently
3. Emergent insights that might not hold under different conditions
4. Tensions that were resolved prematurely or incorrectly
5. Missing perspectives or stakeholder impacts not considered`;

  const researchPrompt = `## Stress-Test Mission

You are a ${archetype.id} agent deployed to stress-test a scenario analysis.
Your lens: ${archetype.lens}
Your analytical bias: ${archetype.bias}

## Scenario Context

${contextSummary}

## Your Task

Critically examine the scenario's findings, emergent insights, and tension resolutions.
Identify the top 3-5 most impactful vulnerabilities, ranked by severity.

For each vulnerability:
- State what the weakness is
- Provide evidence or reasoning for why it's a weakness
- Suggest what could be done to address it
- Rate its severity (CRITICAL / HIGH / MEDIUM / LOW)

Use your available research tools to verify claims and find counter-evidence.
When your analysis is complete, call submit_findings with your structured results.`;

  return {
    name: `${archetype.id} Stress-Tester`,
    archetype: archetype.id,
    dimension,
    mandate: `Stress-test scenario assumptions using ${archetype.lens}`,
    systemPrompt,
    researchPrompt,
    tools: [],
    skills: [],
    color: archetype.id === "RED_TEAM" ? "#ef4444" : "#f59e0b",
    neutralFramingApplied: false,
  };
}

// ─── Context Builder ─────────────────────────────────────────

function buildScenarioContextForStressTest(ir: IRGraph, query: string): string {
  const sections: string[] = [];

  sections.push(`### Research Question\n${query}`);

  // Top emergences
  if (ir.emergences.length > 0) {
    const avgQuality = (scores: IREmergence["qualityScores"]) =>
      (scores.novelty + scores.grounding + scores.actionability + scores.depth + scores.surprise) / 5;
    const topEmergences = ir.emergences
      .sort((a, b) => avgQuality(b.qualityScores) - avgQuality(a.qualityScores))
      .slice(0, 5);
    sections.push(
      `### Key Emergent Insights (${ir.emergences.length} total, showing top 5)\n` +
      topEmergences.map((e, i) =>
        `${i + 1}. **${e.insight}**\n   Supporting agents: ${e.supportingAgents.join(", ")}\n   Quality: ${avgQuality(e.qualityScores).toFixed(1)}/5`
      ).join("\n\n"),
    );
  }

  // Open tensions
  const openTensions = ir.tensions.filter(t => t.status === "open" || t.status === "deferred");
  if (openTensions.length > 0) {
    sections.push(
      `### Active Tensions (${openTensions.length})\n` +
      openTensions.map((t, i) =>
        `${i + 1}. **${t.claim}** [${t.status}]\n   Positions: ${t.positions.map(p => `${p.agent}: "${p.position.slice(0, 100)}"`).join(" vs. ")}`
      ).join("\n\n"),
    );
  }

  // Resolved tensions (these are prime targets for stress-testing)
  const resolvedTensions = ir.tensions.filter(t => t.status === "resolved");
  if (resolvedTensions.length > 0) {
    sections.push(
      `### Resolved Tensions (examine these closely)\n` +
      resolvedTensions.map((t, i) =>
        `${i + 1}. **${t.claim}** — Resolved: "${t.resolution ?? "No resolution text"}"\n   Was this resolution justified?`
      ).join("\n\n"),
    );
  }

  // Top findings by confidence
  const topFindings = ir.findings
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
  if (topFindings.length > 0) {
    sections.push(
      `### Key Findings (${ir.findings.length} total, showing top 10 by confidence)\n` +
      topFindings.map((f, i) =>
        `${i + 1}. [${(f.confidence * 100).toFixed(0)}%] ${f.value}\n   Evidence: ${f.evidenceType} (${f.references.length} refs)`
      ).join("\n"),
    );
  }

  // Gaps
  if (ir.gaps.length > 0) {
    sections.push(
      `### Known Gaps (${ir.gaps.length})\n` +
      ir.gaps.map((g, i) =>
        `${i + 1}. ${g.title} (${g.gapType}, ${g.priority} priority)`
      ).join("\n"),
    );
  }

  return sections.join("\n\n");
}

// ─── Vulnerability Extraction ────────────────────────────────

function extractVulnerabilities(
  agentResults: AgentResult[],
  ir: IRGraph,
): StressTestVulnerability[] {
  const vulnerabilities: StressTestVulnerability[] = [];

  for (const result of agentResults) {
    for (const finding of result.findings) {
      // Map finding confidence to severity
      const severity: StressTestVulnerability["severity"] =
        finding.confidence === "HIGH" ? "critical" :
        finding.confidence === "MEDIUM" ? "high" : "medium";

      // Try to match the finding to a specific target in the IR
      const target = matchFindingToTarget(finding.statement, ir);

      vulnerabilities.push({
        agentName: result.agentName,
        statement: finding.statement,
        evidence: finding.evidence,
        severity,
        targetType: target.type,
        targetId: target.id,
      });
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  vulnerabilities.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return vulnerabilities;
}

function matchFindingToTarget(
  statement: string,
  ir: IRGraph,
): { type: StressTestVulnerability["targetType"]; id?: string } {
  const lower = statement.toLowerCase();

  // Check if it references any emergence
  for (const e of ir.emergences) {
    const words = e.insight.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matchCount = words.filter(w => lower.includes(w)).length;
    if (matchCount >= 3) {
      return { type: "emergence", id: e.id };
    }
  }

  // Check if it references any tension
  for (const t of ir.tensions) {
    const words = t.claim.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matchCount = words.filter(w => lower.includes(w)).length;
    if (matchCount >= 3) {
      return { type: "tension", id: t.id };
    }
  }

  // Check if it references any finding
  for (const f of ir.findings) {
    const words = f.value.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matchCount = words.filter(w => lower.includes(w)).length;
    if (matchCount >= 3) {
      return { type: "finding", id: f.id };
    }
  }

  return { type: "general" };
}

// ─── MemoryBus Population ────────────────────────────────────

function populateBusFromIR(bus: MemoryBus, ir: IRGraph): void {
  for (const finding of ir.findings.slice(0, 50)) { // Cap at 50 for context window
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

async function mergeStressTestFindings(
  scenarioId: string,
  agentResults: AgentResult[],
  vulnerabilities: StressTestVulnerability[],
): Promise<void> {
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { result: true },
  });

  if (!scenario?.result) return;

  // Add stress-test metadata to the scenario result's sensitivity map
  const existingSensitivity = scenario.result.sensitivityMap as unknown as unknown[];
  const stressTestData = {
    type: "stress_test" as const,
    agentResults: agentResults.map(r => ({
      agentName: r.agentName,
      archetype: r.archetype,
      findingCount: r.findings.length,
    })),
    vulnerabilities: vulnerabilities.map(v => ({
      statement: v.statement,
      severity: v.severity,
      targetType: v.targetType,
      targetId: v.targetId,
    })),
    totalVulnerabilities: vulnerabilities.length,
    criticalCount: vulnerabilities.filter(v => v.severity === "critical").length,
    highCount: vulnerabilities.filter(v => v.severity === "high").length,
  };

  await prisma.scenarioResult.update({
    where: { scenarioId },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sensitivityMap: [...existingSensitivity, stressTestData] as any,
    },
  });
}
