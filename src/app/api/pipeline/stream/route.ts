/**
 * GET /api/pipeline/stream?runId=...&query=...
 *
 * SSE (Server-Sent Events) endpoint for real-time PRISM pipeline streaming.
 *
 * Executes the full pipeline (THINK -> CONSTRUCT -> DEPLOY -> SYNTHESIZE ->
 * VERIFY -> PRESENT) and streams PipelineEvent events as they occur.
 */

import { executePipeline } from "@/lib/pipeline/executor";
import { prisma } from "@/lib/prisma";
import type { PipelineEvent, AutonomyMode } from "@/lib/pipeline/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const runId = searchParams.get("runId");
  const autonomyMode = (searchParams.get("autonomyMode") ?? "guided") as AutonomyMode;

  if (!query || !runId) {
    return new Response(
      JSON.stringify({ error: "query and runId are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured. Set it in .env to enable live mode." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream may have been closed by client
        }
      }

      // Heartbeat to keep SSE alive during long phases
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // Map PipelineEvent discriminated union to SSE events
      function handleEvent(event: PipelineEvent) {
        switch (event.type) {
          case "phase_change":
            send("phase_change", { phase: event.phase, message: event.message });
            break;

          case "blueprint":
            send("blueprint", {
              query: event.blueprint.query,
              tier: event.blueprint.tier,
              estimatedTime: event.blueprint.estimatedTime,
              agentCount: event.blueprint.agents.length,
              complexityScore: event.blueprint.complexityScore,
              dimensions: event.blueprint.dimensions.map((d) => ({
                name: d.name,
                description: d.description,
              })),
              agents: event.blueprint.agents.map((a) => ({
                name: a.name,
                archetype: a.archetype,
                dimension: a.dimension,
                mandate: a.mandate,
                tools: a.tools,
              })),
            });
            break;

          case "agent_spawned":
            send("agent_spawned", {
              agentName: event.agentName,
              archetype: event.archetype,
              dimension: event.dimension,
            });
            break;

          case "agent_progress":
            send("agent_progress", {
              agentName: event.agentName,
              progress: event.progress,
              message: event.message,
            });
            break;

          case "tool_call":
            send("tool_call", {
              agentName: event.agentName,
              toolName: event.toolName,
              serverName: event.serverName,
            });
            break;

          case "finding_added":
            send("finding_added", {
              agentName: event.agentName,
              finding: {
                statement: event.finding.statement,
                confidence: event.finding.confidence,
                sourceTier: event.finding.sourceTier,
                evidence: event.finding.evidence,
                source: event.finding.source,
                implication: event.finding.implication,
              },
            });
            break;

          case "agent_complete":
            send("agent_complete", {
              agentName: event.agentName,
              findingCount: event.findingCount,
              tokensUsed: event.tokensUsed,
            });
            break;

          case "synthesis_started":
            send("synthesis_started", { agentCount: event.agentCount });
            break;

          case "synthesis_layer":
            send("synthesis_layer", {
              name: event.layer.name,
              description: event.layer.description,
              insights: event.layer.insights,
            });
            break;

          case "emergence_detected":
            send("emergence_detected", {
              insight: event.insight.insight,
              algorithm: event.insight.algorithm,
              supportingAgents: event.insight.supportingAgents,
              qualityScores: event.insight.qualityScores,
              whyMultiAgent: event.insight.whyMultiAgent,
            });
            break;

          case "critic_review":
            send("critic_review", { issue: event.issue, severity: event.severity });
            break;

          case "verification_gate":
            send("verification_gate", { claims: event.claims });
            break;

          case "quality_report":
            send("quality_report", event.report);
            break;

          case "presentation_started":
            send("presentation_started", {});
            break;

          case "presentation_complete":
            send("presentation_complete", {
              title: event.title,
              slideCount: event.slideCount,
              htmlPath: event.htmlPath,
            });
            break;

          case "complete":
            send("complete", {
              runId: event.manifest.metadata.runId,
              agentCount: event.manifest.agentResults.length,
              totalFindings: event.manifest.qualityReport.totalFindings,
              emergentInsights: event.manifest.synthesis.emergentInsights.length,
              totalTokens: event.manifest.metadata.totalTokens,
              presentationPath: `/decks/${event.manifest.metadata.runId}.html`,
            });
            break;

          case "error":
            send("error", { error: event.message, phase: event.phase });
            break;
        }
      }

      try {
        // Create the Run record in the database
        await prisma.run.create({
          data: {
            id: runId,
            query,
            status: "INITIALIZE",
          },
        });

        await executePipeline({
          query,
          runId,
          autonomyMode,
          onEvent: handleEvent,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send("error", { error: message, phase: "pipeline" });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
