/**
 * Scenario Stress-Test API
 *
 * POST /api/scenarios/[id]/stress-test — Deploy adversarial agents
 *
 * Deploys RED_TEAM + DEVIL'S_ADVOCATE agents against a completed scenario
 * to probe weaknesses, counter-arguments, and vulnerabilities.
 * Returns 202 Accepted and processes asynchronously (~60s).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runStressTest } from "@/lib/scenarios/stress-test";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Validate scenario exists and is complete
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    select: { id: true, status: true, result: { select: { id: true } } },
  });

  if (!scenario) {
    return NextResponse.json(
      { error: "Scenario not found" },
      { status: 404 },
    );
  }

  if (scenario.status !== "complete" || !scenario.result) {
    return NextResponse.json(
      { error: "Scenario must be complete before stress-testing" },
      { status: 400 },
    );
  }

  // Fire and forget — process asynchronously
  runStressTest(id).catch((err) => {
    console.error(`[STRESS-TEST:${id}] Failed:`, err);
  });

  return NextResponse.json(
    {
      scenarioId: id,
      status: "started",
      estimatedTimeSeconds: 60,
      message: "Stress-test agents deployed. Poll the scenario for results.",
    },
    { status: 202 },
  );
}
