import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const signalType = searchParams.get("signalType");
  const severity = searchParams.get("severity");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = {};
  if (signalType) where.signalType = signalType;
  if (severity) where.severity = severity;

  const [signals, total] = await Promise.all([
    prisma.signal.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
      include: { alerts: { select: { id: true, acknowledged: true } } },
    }),
    prisma.signal.count({ where }),
  ]);

  return NextResponse.json({ signals, total, limit, offset });
}
