/**
 * Cron: SENTINEL — Cross-Source Signal Correlation
 * Schedule: Every 6 hours (cron: 0 0/6 * * *)
 *
 * Runs the SignalCorrelator against recent data (feeds, dataset deltas,
 * tool call logs) to detect temporal pattern correlations. Emits Signal
 * and Alert records when predefined pattern thresholds are met.
 */

import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const { runSentinel } = await import("@/lib/signals/sentinel");
    const result = await runSentinel();

    return NextResponse.json({
      ...result,
      status: result.errors.length > 0 ? "partial" : "ok",
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[cron/sentinel] SENTINEL cycle failed:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - startTime,
      },
      { status: 500 },
    );
  }
}
