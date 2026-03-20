/**
 * Scenario CRUD for a specific run
 *
 * POST /api/runs/[id]/scenarios — Create a new scenario
 * GET  /api/runs/[id]/scenarios — List scenarios for a run
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateScenarioSchema, extractAvailableLevers } from "@/lib/scenarios";
import type { IRGraph } from "@/lib/pipeline/ir-types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await params;

  // Validate the run exists and is complete
  const run = await prisma.run.findUnique({
    where: { id: runId },
    select: { id: true, status: true },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.status !== "COMPLETE") {
    return NextResponse.json(
      { error: "Can only create scenarios from completed runs" },
      { status: 400 },
    );
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateScenarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, description, parentId, levers } = parsed.data;

  // Create the scenario with optional levers
  const scenario = await prisma.scenario.create({
    data: {
      name,
      description,
      runId,
      parentId,
      levers: levers
        ? {
            create: levers.map((l) => ({
              leverType: l.leverType,
              targetId: l.targetId,
              targetLabel: l.targetLabel,
              baseline: l.baseline as object,
              adjusted: l.adjusted as object,
            })),
          }
        : undefined,
    },
    include: {
      levers: true,
    },
  });

  return NextResponse.json(scenario, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await params;

  const [run, scenarios, irRecord] = await Promise.all([
    prisma.run.findUnique({
      where: { id: runId },
      select: {
        id: true,
        query: true,
        tier: true,
        status: true,
        completedAt: true,
      },
    }),
    prisma.scenario.findMany({
      where: { runId },
      include: {
        levers: true,
        children: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        result: {
          select: {
            id: true,
            confidenceShift: true,
            computedAt: true,
            briefPath: true,
            memoPath: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.irGraph.findUnique({
      where: { runId },
      select: { graph: true },
    }),
  ]);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Extract available levers from the IR Graph
  let availableLevers = null;
  if (irRecord) {
    try {
      const ir: IRGraph = JSON.parse(irRecord.graph as string);
      availableLevers = extractAvailableLevers(ir);
    } catch {
      // IR Graph parsing failed — levers will be unavailable
    }
  }

  return NextResponse.json({
    run,
    scenarios,
    availableLevers,
  });
}
