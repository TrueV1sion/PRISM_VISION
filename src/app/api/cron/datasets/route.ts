/**
 * Cron: Government Dataset Snapshot Pipeline
 * Schedule: Weekly on Sundays at 3 AM (0 3 * * 0)
 *
 * Downloads bulk government datasets (CMS CHOW, Star Ratings, MA Enrollment, etc.),
 * creates DatasetSnapshot records, computes deltas against previous snapshots,
 * and stores DatasetDelta records for downstream signal correlation.
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
    const { snapshotAllDatasets } = await import("@/lib/datasets/downloader");
    const snapshotResult = await snapshotAllDatasets();

    const result = {
      status: "ok",
      datasetsProcessed: snapshotResult.processed,
      snapshotsCreated: snapshotResult.snapshots,
      errors: snapshotResult.errors.length,
      errorDetails: snapshotResult.errors.slice(0, 5),
    };

    return NextResponse.json({
      ...result,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[cron/datasets] Dataset snapshot failed:", error);
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
