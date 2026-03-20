/**
 * Individual scenario operations
 *
 * GET    /api/scenarios/[id] — Get scenario with levers, result, and available levers
 * DELETE /api/scenarios/[id] — Delete a scenario
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractAvailableLevers } from "@/lib/scenarios";
import type { IRGraph } from "@/lib/pipeline/ir-types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: {
      levers: true,
      result: true,
      children: {
        select: { id: true, name: true, status: true },
      },
      run: {
        select: {
          id: true,
          query: true,
          tier: true,
          status: true,
        },
      },
    },
  });

  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  // Load available levers from the baseline IR Graph
  let availableLevers = null;
  const irRecord = await prisma.irGraph.findUnique({
    where: { runId: scenario.runId },
    select: { graph: true },
  });

  if (irRecord) {
    try {
      const ir: IRGraph = JSON.parse(irRecord.graph as string);
      availableLevers = extractAvailableLevers(ir);
    } catch {
      // Ignore parsing errors
    }
  }

  return NextResponse.json({
    ...scenario,
    availableLevers,
  });
}

/**
 * PATCH /api/scenarios/[id] — Reset a stuck scenario
 * Body: { status: "draft" }
 * Only allows resetting from "computing" → "draft"
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status !== "draft") {
    return NextResponse.json(
      { error: "Only resetting to 'draft' status is allowed" },
      { status: 400 },
    );
  }

  const scenario = await prisma.scenario.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  if (scenario.status !== "computing" && scenario.status !== "failed") {
    return NextResponse.json(
      { error: `Cannot reset scenario with status '${scenario.status}'. Only 'computing' or 'failed' scenarios can be reset.` },
      { status: 400 },
    );
  }

  const updated = await prisma.scenario.update({
    where: { id },
    data: { status: "draft" },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.scenario.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }
}
