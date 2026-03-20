/**
 * Compare two scenarios
 *
 * GET /api/scenarios/[id]/diff/[otherId] — Diff two scenario results
 *
 * Compares the IR Graphs from two completed scenarios (or one scenario vs baseline).
 * Use otherId="baseline" to compare against the original run's IR Graph.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diffIRGraphs } from "@/lib/scenarios";
import type { IRGraph } from "@/lib/pipeline/ir-types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; otherId: string }> },
) {
  const { id, otherId } = await params;

  // Load scenario A
  const scenarioA = await prisma.scenario.findUnique({
    where: { id },
    include: {
      result: true,
      levers: { select: { id: true, targetId: true, targetLabel: true, leverType: true } },
    },
  });

  if (!scenarioA || !scenarioA.result) {
    return NextResponse.json(
      { error: "Scenario A not found or not yet computed" },
      { status: 404 },
    );
  }

  let irA: IRGraph;
  let irB: IRGraph;

  try {
    irA = scenarioA.result.modifiedIrGraph as unknown as IRGraph;
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Scenario A IR Graph" },
      { status: 500 },
    );
  }

  if (otherId === "baseline") {
    // Compare against the original run's baseline IR Graph
    const baselineRecord = await prisma.irGraph.findUnique({
      where: { runId: scenarioA.runId },
      select: { graph: true },
    });

    if (!baselineRecord) {
      return NextResponse.json(
        { error: "Baseline IR Graph not found" },
        { status: 404 },
      );
    }

    try {
      irB = JSON.parse(baselineRecord.graph as string);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse baseline IR Graph" },
        { status: 500 },
      );
    }
  } else {
    // Compare against another scenario
    const scenarioB = await prisma.scenario.findUnique({
      where: { id: otherId },
      include: { result: true },
    });

    if (!scenarioB || !scenarioB.result) {
      return NextResponse.json(
        { error: "Scenario B not found or not yet computed" },
        { status: 404 },
      );
    }

    try {
      irB = scenarioB.result.modifiedIrGraph as unknown as IRGraph;
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Scenario B IR Graph" },
        { status: 500 },
      );
    }
  }

  // Diff: A is "modified", B is "baseline"
  const diff = diffIRGraphs(irB, irA, scenarioA.levers);

  return NextResponse.json({
    scenarioAId: id,
    scenarioBId: otherId,
    diff,
  });
}
