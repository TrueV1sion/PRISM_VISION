/**
 * GET  /api/feeds — List all feed sources with status
 * POST /api/feeds — Add a new feed source (or trigger re-ingestion)
 */

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { prisma } = await import("@/lib/prisma");

    const sources = await prisma.feedSource.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { items: true } },
      },
    });

    // Aggregate stats
    const totalItems = sources.reduce((sum, s) => sum + s._count.items, 0);
    const enabledCount = sources.filter((s) => s.enabled).length;
    const errorCount = sources.filter((s) => s.lastError).length;

    return NextResponse.json({
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        feedType: s.feedType,
        category: s.category,
        subcategory: s.subcategory,
        pollIntervalHours: s.pollIntervalHours,
        enabled: s.enabled,
        lastPolledAt: s.lastPolledAt?.toISOString() ?? null,
        lastError: s.lastError,
        itemCount: s._count.items,
      })),
      stats: {
        totalSources: sources.length,
        enabledSources: enabledCount,
        totalItems,
        sourcesWithErrors: errorCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to list feed sources: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prisma } = await import("@/lib/prisma");

    // Action: trigger single-feed re-ingestion
    if (body.action === "ingest" && body.sourceId) {
      const { ingestFeed } = await import("@/lib/feeds/ingestor");
      const result = await ingestFeed(body.sourceId as string);
      return NextResponse.json({
        status: "ok",
        sourceId: body.sourceId,
        newItems: result.newItems,
      });
    }

    // Action: toggle enabled/disabled
    if (body.action === "toggle" && body.sourceId) {
      const source = await prisma.feedSource.findUnique({
        where: { id: body.sourceId as string },
      });
      if (!source) {
        return NextResponse.json({ error: "Source not found" }, { status: 404 });
      }
      const updated = await prisma.feedSource.update({
        where: { id: body.sourceId as string },
        data: { enabled: !source.enabled },
      });
      return NextResponse.json({
        status: "ok",
        sourceId: updated.id,
        enabled: updated.enabled,
      });
    }

    // Action: add a new custom feed source
    if (body.url && body.name && body.category) {
      const source = await prisma.feedSource.create({
        data: {
          url: body.url as string,
          name: body.name as string,
          feedType: (body.feedType as string) ?? "rss",
          category: body.category as string,
          subcategory: (body.subcategory as string) ?? null,
          pollIntervalHours: (body.pollIntervalHours as number) ?? 4,
          enabled: true,
        },
      });
      return NextResponse.json({ status: "created", source }, { status: 201 });
    }

    return NextResponse.json(
      {
        error:
          "Invalid request. Provide {url, name, category} to add a source, " +
          "{action: 'ingest', sourceId} to trigger ingestion, or " +
          "{action: 'toggle', sourceId} to enable/disable.",
      },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Handle unique constraint violation for duplicate URLs
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A feed source with this URL already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: `Failed to process request: ${message}` },
      { status: 500 },
    );
  }
}
