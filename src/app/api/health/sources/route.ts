import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [feedSources, datasetSources, recentSignals, pendingAlerts] =
    await Promise.all([
      prisma.feedSource.findMany({
        select: {
          id: true,
          name: true,
          category: true,
          enabled: true,
          lastPolledAt: true,
          lastError: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.datasetSource.findMany({
        select: {
          id: true,
          name: true,
          category: true,
          enabled: true,
          lastPolledAt: true,
          lastError: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.signal.count({
        where: {
          detectedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.alert.count({ where: { acknowledged: false } }),
    ]);

  const feedHealth = feedSources.map((s) => ({
    ...s,
    status: !s.enabled
      ? "disabled"
      : s.lastError != null
        ? "unreachable"
        : s.lastPolledAt &&
            Date.now() - s.lastPolledAt.getTime() > 12 * 60 * 60 * 1000
          ? "stale"
          : "healthy",
  }));

  const datasetHealth = datasetSources.map((s) => ({
    ...s,
    status: !s.enabled
      ? "disabled"
      : s.lastError != null
        ? "unreachable"
        : s.lastPolledAt &&
            Date.now() - s.lastPolledAt.getTime() > 7 * 24 * 60 * 60 * 1000
          ? "stale"
          : "healthy",
  }));

  return NextResponse.json({
    feeds: { total: feedSources.length, sources: feedHealth },
    datasets: { total: datasetSources.length, sources: datasetHealth },
    signals: { last24h: recentSignals },
    alerts: { pending: pendingAlerts },
  });
}
