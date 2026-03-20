/**
 * Trigger scenario computation
 *
 * POST /api/scenarios/[id]/compute — Re-synthesize with lever mutations
 *
 * This is the core "what-if" engine: forks the baseline MemoryBus,
 * applies lever adjustments, re-runs SYNTHESIZE (~30s), and diffs.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeScenario } from "@/lib/scenarios";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scenarioId } = await params;

  // Validate scenario exists
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: {
      id: true,
      status: true,
      levers: { select: { id: true } },
    },
  });

  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  if (scenario.status === "computing") {
    return NextResponse.json(
      { error: "Scenario is already computing" },
      { status: 409 },
    );
  }

  if (scenario.levers.length === 0) {
    return NextResponse.json(
      { error: "Add at least one lever before computing" },
      { status: 400 },
    );
  }

  // Run computation asynchronously — return immediately with 202
  // The frontend polls or uses SSE to check status
  computeScenario(scenarioId).catch((err) => {
    console.error(`[SCENARIO:${scenarioId}] Computation failed:`, err);
    // Status already set to "failed" in computeScenario's error handler
  });

  return NextResponse.json(
    {
      scenarioId,
      status: "computing",
      message: "Scenario computation started. Poll GET /api/scenarios/[id] for status.",
      estimatedTimeSeconds: 30,
    },
    { status: 202 },
  );
}
