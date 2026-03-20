/**
 * PRISM Scenario Computation Engine
 *
 * Computes scenario results by:
 * 1. Loading the baseline MemoryBus snapshot from the parent run
 * 2. Forking the MemoryBus
 * 3. Applying lever mutations
 * 4. Re-running SYNTHESIZE with the mutated state
 * 5. Diffing the result against baseline IR Graph
 *
 * The key insight: SYNTHESIZE takes ~30s, not the 3-5 min of a full pipeline.
 * This makes scenario exploration feel interactive, not batch.
 */

import { prisma } from "@/lib/prisma";
import { MemoryBus } from "@/lib/pipeline/memory-bus";
import type { ScenarioLeverInput } from "@/lib/pipeline/memory-bus";
import { synthesize } from "@/lib/pipeline/synthesize";
import type { AgentResult, Blueprint } from "@/lib/pipeline/types";
import type { IRGraph } from "@/lib/pipeline/ir-types";
import { buildIRGraph } from "./ir-builder";
import { diffIRGraphs } from "./diff";
import type {
  ScenarioComputeResult,
  ScenarioDiff,
  SensitivityEntry,
  CreateLeverInput,
} from "./types";

// ─── Main Compute Function ──────────────────────────────────

/**
 * Compute a scenario by forking the parent run's MemoryBus,
 * applying lever mutations, and re-running synthesis.
 */
export async function computeScenario(scenarioId: string): Promise<ScenarioComputeResult> {
  const startTime = Date.now();

  // 1. Load the scenario with its levers
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: {
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

  // 2. Load the baseline MemoryBus snapshot (SYNTHESIZE phase preferred, then DEPLOY)
  const snapshot = await prisma.memoryBusSnapshot.findFirst({
    where: { runId: scenario.runId },
    orderBy: { createdAt: "desc" },
  });

  if (!snapshot) {
    throw new Error(`No MemoryBus snapshot found for run ${scenario.runId}. Cannot compute scenario.`);
  }

  // 3. Load the baseline IR Graph for diffing
  const baselineIrRecord = await prisma.irGraph.findUnique({
    where: { runId: scenario.runId },
    select: { graph: true },
  });

  if (!baselineIrRecord) {
    throw new Error(`No IR Graph found for run ${scenario.runId}`);
  }

  const baselineIR: IRGraph = JSON.parse(baselineIrRecord.graph as string);

  // 4. Fork the MemoryBus and apply levers
  const baseBus = MemoryBus.import(snapshot.snapshot);
  const forkedBus = baseBus.fork();

  // Initialize IR on the forked bus from baseline
  forkedBus.initIR(scenario.runId);
  const forkedIR = forkedBus.getIRGraph();
  if (forkedIR) {
    // Deep-copy baseline IR into the forked bus
    Object.assign(forkedIR, JSON.parse(JSON.stringify(baselineIR)));
  }

  for (const lever of scenario.levers) {
    const leverInput: ScenarioLeverInput = {
      leverType: lever.leverType as ScenarioLeverInput["leverType"],
      targetId: lever.targetId,
      baseline: lever.baseline,
      adjusted: lever.adjusted,
    };
    forkedBus.applyLever(leverInput);
  }

  // 5. Reconstruct agent results from the baseline run's stored data
  const agentResults = await reconstructAgentResults(scenario.runId);

  if (agentResults.length < 2) {
    throw new Error(`Need at least 2 agent results to re-synthesize. Found ${agentResults.length}.`);
  }

  // 6. Build a lightweight blueprint for re-synthesis
  const uniqueDimensions = [...new Set(scenario.run.agents.map(a => a.dimension))];
  const blueprint: Blueprint = {
    query: scenario.run.query,
    tier: scenario.run.tier as Blueprint["tier"],
    complexityScore: {
      breadth: 3, depth: 3, interconnection: 3,
      total: 9, urgency: 1.0, adjusted: 9, reasoning: "Scenario re-synthesis",
    },
    dimensions: uniqueDimensions.map(d => ({
      name: d,
      description: `Dimension: ${d}`,
      justification: "Carried from baseline run",
      dataSources: [],
      lens: "",
      signalMatch: "",
    })),
    agents: scenario.run.agents.map(a => ({
      name: a.name,
      archetype: a.archetype,
      dimension: a.dimension,
      mandate: "",
      tools: [],
      lens: "",
      bias: "",
    })),
    interconnections: [],
    estimatedTime: "~30s (scenario re-synthesis)",
    ethicalConcerns: [],
  };

  // 7. Mark scenario as computing
  await prisma.scenario.update({
    where: { id: scenarioId },
    data: { status: "computing" },
  });

  // 8. Re-run SYNTHESIZE with the forked MemoryBus
  let modifiedIR: IRGraph;
  try {
    const synthResult = await synthesize({
      agentResults,
      blueprint,
      memoryBus: forkedBus,
      emitEvent: (event) => {
        // Scenario computation events are logged but not streamed (for now)
        console.log(`[SCENARIO:${scenarioId}] ${event.type}`);
      },
    });

    // 9. Build the modified IR Graph from the re-synthesis
    modifiedIR = buildIRGraph(baselineIR, synthResult, forkedBus);
  } catch (err) {
    await prisma.scenario.update({
      where: { id: scenarioId },
      data: { status: "failed" },
    });
    throw err;
  }

  // 10. Diff against baseline
  const diff = diffIRGraphs(baselineIR, modifiedIR, scenario.levers);

  // 11. Compute sensitivity map
  const sensitivityMap = computeSensitivity(
    baselineIR,
    modifiedIR,
    scenario.levers,
    diff,
  );

  // 12. Persist the result
  await prisma.scenarioResult.upsert({
    where: { scenarioId },
    create: {
      scenarioId,
      modifiedIrGraph: JSON.parse(JSON.stringify(modifiedIR)),
      emergencesDelta: JSON.parse(JSON.stringify(diff.emergencesDelta)),
      tensionsDelta: JSON.parse(JSON.stringify(diff.tensionsDelta)),
      sensitivityMap: JSON.parse(JSON.stringify(sensitivityMap)),
      confidenceShift: diff.confidenceShift,
    },
    update: {
      modifiedIrGraph: JSON.parse(JSON.stringify(modifiedIR)),
      emergencesDelta: JSON.parse(JSON.stringify(diff.emergencesDelta)),
      tensionsDelta: JSON.parse(JSON.stringify(diff.tensionsDelta)),
      sensitivityMap: JSON.parse(JSON.stringify(sensitivityMap)),
      confidenceShift: diff.confidenceShift,
      computedAt: new Date(),
    },
  });

  // Update lever impact ratings
  for (const entry of sensitivityMap) {
    const impact = entry.impactScore > 0.6 ? "high" : entry.impactScore > 0.3 ? "medium" : "low";
    await prisma.scenarioLever.updateMany({
      where: { scenarioId, targetId: entry.leverId },
      data: { impact },
    });
  }

  // 13. Mark scenario as complete
  await prisma.scenario.update({
    where: { id: scenarioId },
    data: { status: "complete" },
  });

  const computeTimeMs = Date.now() - startTime;
  console.log(`[SCENARIO:${scenarioId}] Computation complete in ${computeTimeMs}ms`);

  return {
    modifiedIrGraph: modifiedIR,
    diff,
    computeTimeMs,
  };
}


// ─── Agent Result Reconstruction ─────────────────────────────

/**
 * Reconstruct AgentResult objects from the database.
 * These are needed to feed the SYNTHESIZE phase.
 */
async function reconstructAgentResults(runId: string): Promise<AgentResult[]> {
  const agents = await prisma.agent.findMany({
    where: { runId, status: "complete" },
    include: {
      findings: true,
    },
  });

  return agents.map(agent => ({
    agentName: agent.name,
    archetype: agent.archetype,
    dimension: agent.dimension,
    findings: agent.findings.map(f => ({
      statement: f.statement,
      evidence: f.evidence,
      confidence: f.confidence as "HIGH" | "MEDIUM" | "LOW",
      sourceTier: f.sourceTier as "PRIMARY" | "SECONDARY" | "TERTIARY",
      evidenceType: f.evidenceType as "direct" | "inferred" | "analogical" | "modeled",
      source: f.source,
      implication: f.implication,
      tags: JSON.parse(f.tags) as string[],
    })),
    gaps: [], // Gaps aren't stored separately per-agent in the DB
    signals: [],
    minorityViews: [],
    toolsUsed: JSON.parse(agent.tools) as string[],
    tokensUsed: 0,
  }));
}


// ─── Sensitivity Computation ─────────────────────────────────

/**
 * Compute how much each lever contributed to the overall changes.
 * Uses a simple heuristic: levers whose target IDs appear in the
 * delta's affected entities get higher impact scores.
 */
function computeSensitivity(
  baseline: IRGraph,
  modified: IRGraph,
  levers: Array<{ id: string; targetId: string; targetLabel: string; leverType: string }>,
  diff: ScenarioDiff,
): SensitivityEntry[] {
  const allChangedEmergenceIds = new Set(
    diff.emergencesDelta.map(d => d.emergence.id),
  );
  const allChangedTensionIds = new Set(
    diff.tensionsDelta.map(d => d.tension.id),
  );

  return levers.map(lever => {
    // Check how many emergences/tensions this lever's target is connected to
    let affectedEmergences: string[] = [];
    const affectedTensions: string[] = [];

    // For tension_flip: the tension itself is directly affected
    if (lever.leverType === "tension_flip" && allChangedTensionIds.has(lever.targetId)) {
      affectedTensions.push(lever.targetId);
    }

    // For finding_suppress/amplify: check which emergences reference this finding
    if (lever.leverType === "finding_suppress" || lever.leverType === "finding_amplify") {
      affectedEmergences = modified.emergences
        .filter(e =>
          e.constituentFindingIds.includes(lever.targetId) &&
          allChangedEmergenceIds.has(e.id),
        )
        .map(e => e.id);
    }

    // For gap_resolve: check new emergences that appeared (gap resolutions create new evidence)
    if (lever.leverType === "gap_resolve") {
      affectedEmergences = diff.emergencesDelta
        .filter(d => d.type === "new")
        .map(d => d.emergence.id);
    }

    const totalAffected = affectedEmergences.length + affectedTensions.length;
    const totalChanges = diff.emergencesDelta.length + diff.tensionsDelta.length;
    const impactScore = totalChanges > 0 ? Math.min(1, totalAffected / Math.max(1, totalChanges * 0.5)) : 0;

    return {
      leverId: lever.targetId,
      leverLabel: lever.targetLabel,
      leverType: lever.leverType as SensitivityEntry["leverType"],
      impactScore,
      affectedEmergences,
      affectedTensions,
    };
  });
}
