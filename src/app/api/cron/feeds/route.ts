/**
 * Cron: RSS Feed Ingestion
 * Schedule: Every 4 hours (cron: 0 0/4 * * *)
 *
 * Polls all enabled FeedSource records, fetches new articles,
 * deduplicates by contentHash, extracts entities and signal classifications,
 * and persists new FeedItems.
 */

import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(request: Request) {
  // Verify cron authorization
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const { ingestAllFeeds } = await import("@/lib/feeds/ingestor");
    const ingestionResult = await ingestAllFeeds();

    const result = {
      status: "ok",
      sourcesPolled: ingestionResult.processed,
      newItems: ingestionResult.newItems,
      errors: ingestionResult.errors.length,
      errorDetails: ingestionResult.errors.slice(0, 5),
    };

    return NextResponse.json({
      ...result,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[cron/feeds] Feed ingestion failed:", error);
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
