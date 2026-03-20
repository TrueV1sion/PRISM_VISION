/**
 * Scenario lever management
 *
 * PATCH /api/scenarios/[id]/levers — Replace all levers for a scenario
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateLeversSchema } from "@/lib/scenarios";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scenarioId } = await params;

  // Verify scenario exists and is in draft/failed state (can edit levers)
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { id: true, status: true },
  });

  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  if (scenario.status === "computing") {
    return NextResponse.json(
      { error: "Cannot modify levers while scenario is computing" },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateLeversSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  // Replace all levers atomically
  await prisma.$transaction([
    prisma.scenarioLever.deleteMany({ where: { scenarioId } }),
    ...parsed.data.levers.map((l) =>
      prisma.scenarioLever.create({
        data: {
          scenarioId,
          leverType: l.leverType,
          targetId: l.targetId,
          targetLabel: l.targetLabel,
          baseline: l.baseline as object,
          adjusted: l.adjusted as object,
        },
      }),
    ),
    // Reset status to draft if it was complete/failed (levers changed = need recompute)
    prisma.scenario.update({
      where: { id: scenarioId },
      data: { status: "draft" },
    }),
  ]);

  const updated = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { levers: true },
  });

  return NextResponse.json(updated);
}
