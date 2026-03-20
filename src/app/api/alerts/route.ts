import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const alertType = searchParams.get("alertType");
  const severity = searchParams.get("severity");
  const acknowledged = searchParams.get("acknowledged");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = {};
  if (alertType) where.alertType = alertType;
  if (severity) where.severity = severity;
  if (acknowledged !== null) where.acknowledged = acknowledged === "true";

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
      include: {
        signal: { select: { id: true, signalType: true, title: true } },
      },
    }),
    prisma.alert.count({ where }),
  ]);

  return NextResponse.json({ alerts, total, limit, offset });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { alertId, acknowledged, acknowledgedBy } = body;

  if (!alertId) {
    return NextResponse.json({ error: "alertId required" }, { status: 400 });
  }

  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      acknowledged: acknowledged ?? true,
      acknowledgedBy: acknowledgedBy ?? "system",
      acknowledgedAt: acknowledged ? new Date() : null,
    },
  });

  return NextResponse.json({ alert });
}
