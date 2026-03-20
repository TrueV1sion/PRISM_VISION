/**
 * Scenario Forecast API
 *
 * POST /api/scenarios/[id]/forecast — Deploy forward-looking agents
 *
 * Deploys FUTURIST + domain-relevant agents against a completed scenario
 * to build scenario trees: optimistic, pessimistic, and most-likely futures.
 * Returns 202 Accepted and processes asynchronously (~60s).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runForecast } from "@/lib/scenarios/forecast";

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
      { error: "Scenario must be complete before forecasting" },
      { status: 400 },
    );
  }

  // Fire and forget — process asynchronously
  runForecast(id).catch((err) => {
    console.error(`[FORECAST:${id}] Failed:`, err);
  });

  return NextResponse.json(
    {
      scenarioId: id,
      status: "started",
      estimatedTimeSeconds: 60,
      message: "Forecast agents deployed. Poll the scenario for results.",
    },
    { status: 202 },
  );
}
