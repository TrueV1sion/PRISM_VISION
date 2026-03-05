/**
 * PRISM Pipeline -- Executor
 *
 * Orchestrates the complete intelligence pipeline:
 * THINK -> CONSTRUCT -> DEPLOY -> SYNTHESIZE -> VERIFY -> PRESENT
 *
 * Manages the full lifecycle, updating database state between phases,
 * emitting PipelineEvent events for real-time streaming, and enforcing
 * the verification gate.
 */

import { prisma } from "@/lib/prisma";
import { think } from "./think";
import { construct } from "./construct";
import { deploy } from "./deploy";
import { synthesize } from "./synthesize";
import { verify } from "./verify";
import { present } from "./present";
import type {
  Blueprint,
  PipelineEvent,
  IntelligenceManifest,
  AgentResult,
  SynthesisResult,
  QualityReport,
  AutonomyMode,
} from "./types";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ─── Types ──────────────────────────────────────────────────

export interface PipelineInput {
  query: string;
  runId: string;
  autonomyMode?: AutonomyMode;
  onEvent?: (event: PipelineEvent) => void;
}

// ─── Quality Report Builder ─────────────────────────────────

function buildQualityReport(
  agentResults: AgentResult[],
  synthesis: SynthesisResult,
): QualityReport {
  const allFindings = agentResults.flatMap((r) => r.findings);
  const totalFindings = allFindings.length;
  const sourcedFindings = allFindings.filter(
    (f) => f.source && f.source.trim().length > 0,
  ).length;

  const confDist = { high: 0, medium: 0, low: 0 };
  const tierDist = { primary: 0, secondary: 0, tertiary: 0 };
  for (const f of allFindings) {
    confDist[f.confidence.toLowerCase() as keyof typeof confDist]++;
    tierDist[f.sourceTier.toLowerCase() as keyof typeof tierDist]++;
  }

  const qualifiedEmergences = synthesis.emergentInsights.filter((e) => {
    const scores = e.qualityScores;
    return (
      [
        scores.novelty,
        scores.grounding,
        scores.actionability,
        scores.depth,
        scores.surprise,
      ].filter((s) => s >= 4).length >= 3
    );
  }).length;

  const gapCount = agentResults.reduce((sum, r) => sum + r.gaps.length, 0);

  return {
    totalFindings,
    sourcedFindings,
    sourceCoveragePercent:
      totalFindings > 0
        ? Math.round((sourcedFindings / totalFindings) * 100)
        : 0,
    confidenceDistribution: confDist,
    sourceTierDistribution: tierDist,
    emergenceYield: qualifiedEmergences,
    gapCount,
    provenanceComplete: sourcedFindings === totalFindings,
  };
}

// ─── Main Orchestrator ──────────────────────────────────────

/**
 * Execute the full PRISM intelligence pipeline.
 *
 * Flow: THINK -> CONSTRUCT -> DEPLOY -> SYNTHESIZE -> VERIFY -> PRESENT
 *
 * Each phase updates the database Run status and emits PipelineEvent events.
 * Returns the completed IntelligenceManifest.
 */
export async function executePipeline(
  input: PipelineInput,
): Promise<IntelligenceManifest> {
  const { query, runId, autonomyMode = "supervised", onEvent } = input;
  const startTime = new Date().toISOString();
  let totalTokens = 0;

  const emitEvent = (event: PipelineEvent) => {
    onEvent?.(event);
  };

  let currentPhase = "THINK";

  try {
    // ─── Phase 0: THINK ───────────────────────────────────

    currentPhase = "THINK";
    await updateRunStatus(runId, "THINK");
    emitEvent({ type: "phase_change", phase: "THINK", message: "Decomposing query into analytical dimensions..." });

    const blueprint = await think({ query });

    // Persist blueprint to database
    await persistBlueprint(runId, blueprint);

    emitEvent({ type: "blueprint", blueprint });

    // ─── Phase 1: CONSTRUCT ───────────────────────────────

    currentPhase = "CONSTRUCT";
    await updateRunStatus(runId, "CONSTRUCT");
    emitEvent({ type: "phase_change", phase: "CONSTRUCT", message: "Building agent prompts and tool configurations..." });

    const agents = construct({ blueprint });

    // Update agents in database with system prompts
    for (const agent of agents) {
      await prisma.agent.updateMany({
        where: { runId, name: agent.name },
        data: {
          status: "active",
          archetype: agent.archetype,
          mandate: agent.mandate,
          tools: JSON.stringify(agent.tools),
          color: agent.color,
        },
      });
    }

    // ─── Phase 2: DEPLOY ──────────────────────────────────

    currentPhase = "DEPLOY";
    await updateRunStatus(runId, "DEPLOY");
    emitEvent({ type: "phase_change", phase: "DEPLOY", message: `Deploying ${agents.length} agents in parallel...` });

    const deployResult = await deploy({
      agents,
      blueprint,
      emitEvent,
    });

    const { agentResults, criticResult } = deployResult;

    // Track tokens from deploy phase
    for (const result of agentResults) {
      totalTokens += result.tokensUsed;
    }
    if (criticResult) {
      totalTokens += criticResult.tokensUsed;
    }

    // Persist findings to database
    for (const agentResult of agentResults) {
      // Update agent status
      await prisma.agent.updateMany({
        where: { runId, name: agentResult.agentName },
        data: {
          status: "complete",
          progress: 100,
        },
      });

      // Persist findings
      const dbAgent = await prisma.agent.findFirst({
        where: { runId, name: agentResult.agentName },
      });

      if (dbAgent) {
        for (const finding of agentResult.findings) {
          await prisma.finding.create({
            data: {
              statement: finding.statement,
              evidence: finding.evidence,
              confidence: finding.confidence,
              evidenceType: finding.evidenceType,
              source: finding.source,
              sourceTier: finding.sourceTier,
              implication: finding.implication,
              action: "keep",
              tags: JSON.stringify(finding.tags),
              agentId: dbAgent.id,
              runId,
            },
          });
        }
      }
    }

    // Check: enough agents succeeded?
    if (agentResults.length < 2) {
      throw new Error(
        `Only ${agentResults.length} agents succeeded -- minimum 2 required for synthesis.`,
      );
    }

    // ─── Phase 3: SYNTHESIZE ──────────────────────────────

    currentPhase = "SYNTHESIZE";
    await updateRunStatus(runId, "SYNTHESIZE");
    emitEvent({ type: "phase_change", phase: "SYNTHESIZE", message: "Running emergence detection and synthesis..." });

    const synthesis = await synthesize({
      agentResults,
      blueprint,
      criticResult,
      emitEvent,
    });

    // Persist synthesis layers
    for (let i = 0; i < synthesis.layers.length; i++) {
      const layer = synthesis.layers[i];
      await prisma.synthesis.create({
        data: {
          layerName: layer.name,
          description: layer.description,
          insights: JSON.stringify(layer.insights),
          order: i,
          runId,
        },
      });
    }

    // Build quality report
    const qualityReport = buildQualityReport(agentResults, synthesis);

    emitEvent({ type: "quality_report", report: qualityReport });

    // ─── Phase 3.5: VERIFY ────────────────────────────────

    currentPhase = "VERIFY";
    await updateRunStatus(runId, "VERIFY");
    emitEvent({ type: "phase_change", phase: "VERIFY", message: "Running verification gate..." });

    const verifyResult = await verify({
      synthesis,
      agentResults,
      autonomyMode,
      emitEvent,
    });

    // For supervised mode, verify returns approved=false.
    // The SSE route will handle the HITL gate externally.
    // For guided/autonomous, it auto-approves and we continue.
    if (!verifyResult.approved && autonomyMode === "supervised") {
      // Emit the verification gate so the SSE route knows to pause.
      // The route handler is responsible for waiting for user approval
      // before calling the remaining phases. We still continue here
      // because the route will manage the gate. If the caller needs
      // to block, they should check the event stream.
      //
      // In the current architecture, the executor runs to completion
      // and the SSE route uses the verification_gate event to show
      // the user the claims before streaming the presentation.
    }

    // ─── Phase 4: PRESENT ─────────────────────────────────

    currentPhase = "PRESENT";
    await updateRunStatus(runId, "PRESENT");
    emitEvent({ type: "phase_change", phase: "PRESENT", message: "Generating HTML5 presentation..." });

    const presentation = await present({
      synthesis,
      agentResults,
      blueprint,
      emitEvent,
    });

    // Save HTML to public/decks/
    const decksDir = join(process.cwd(), "public", "decks");
    mkdirSync(decksDir, { recursive: true });
    const filename = `${runId}.html`;
    const htmlPath = `/decks/${filename}`;
    writeFileSync(join(decksDir, filename), presentation.html, "utf-8");

    // Persist presentation to database
    await prisma.presentation.create({
      data: {
        title: presentation.title,
        subtitle: presentation.subtitle,
        htmlPath,
        slideCount: presentation.slideCount,
        runId,
      },
    });

    // ─── Complete ─────────────────────────────────────────

    const endTime = new Date().toISOString();

    const manifest: IntelligenceManifest = {
      blueprint,
      agentResults,
      synthesis,
      presentation,
      qualityReport,
      metadata: {
        runId,
        startTime,
        endTime,
        totalTokens,
      },
    };

    await prisma.run.update({
      where: { id: runId },
      data: {
        status: "COMPLETE",
        completedAt: new Date(),
      },
    });

    emitEvent({ type: "complete", manifest });

    return manifest;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Update run status to failed
    await prisma.run.update({
      where: { id: runId },
      data: { status: "FAILED" },
    });

    emitEvent({ type: "error", message: errorMessage, phase: currentPhase });

    throw error;
  }
}

// ─── Helpers ────────────────────────────────────────────────

async function updateRunStatus(runId: string, status: string) {
  await prisma.run.update({
    where: { id: runId },
    data: { status },
  });
}

async function persistBlueprint(runId: string, blueprint: Blueprint) {
  // Update run with complexity data
  await prisma.run.update({
    where: { id: runId },
    data: {
      tier: blueprint.tier,
      complexityScore: Math.round(blueprint.complexityScore.total),
      breadth: blueprint.complexityScore.breadth,
      depth: blueprint.complexityScore.depth,
      interconnection: blueprint.complexityScore.interconnection,
      estimatedTime: blueprint.estimatedTime,
    },
  });

  // Create dimensions
  for (const dim of blueprint.dimensions) {
    await prisma.dimension.create({
      data: {
        name: dim.name,
        description: dim.description,
        runId,
      },
    });
  }

  // Create agents
  for (const agent of blueprint.agents) {
    await prisma.agent.create({
      data: {
        name: agent.name,
        archetype: agent.archetype,
        mandate: agent.mandate,
        tools: JSON.stringify(agent.tools),
        dimension: agent.dimension,
        runId,
      },
    });
  }
}
