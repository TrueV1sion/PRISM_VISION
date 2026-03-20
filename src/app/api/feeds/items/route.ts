/**
 * GET /api/feeds/items — Search feed items with filters
 *
 * Query parameters:
 *   keyword    — Search title and summary (case-insensitive)
 *   category   — Feed source category (regulatory, legislative, industry, research, ma-payer, innovation)
 *   signal     — Signal type (drug_approval, regulatory_change, ma_activity, etc.)
 *   entity     — Entity name filter (company, drug, agency)
 *   dateFrom   — Start date (YYYY-MM-DD), defaults to 7 days ago
 *   dateTo     — End date (YYYY-MM-DD), defaults to today
 *   limit      — Max results (default 20, max 100)
 *   offset     — Pagination offset (default 0)
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const { searchParams } = new URL(request.url);

    const keyword = searchParams.get("keyword") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const signal = searchParams.get("signal") ?? undefined;
    const entity = searchParams.get("entity") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

    // Date range defaults to last 7 days
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const dateFrom = searchParams.has("dateFrom")
      ? new Date(searchParams.get("dateFrom")!)
      : defaultFrom;
    const dateTo = searchParams.has("dateTo")
      ? new Date(searchParams.get("dateTo")!)
      : now;

    // Validate dates
    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 },
      );
    }

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      publishedAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    if (category) {
      where.source = { category };
    }

    if (signal) {
      where.signals = { has: signal };
    }

    if (entity) {
      where.entities = { has: entity };
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { summary: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // Execute query with count
    const [items, totalCount] = await Promise.all([
      prisma.feedItem.findMany({
        where,
        include: {
          source: {
            select: { name: true, category: true, subcategory: true },
          },
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.feedItem.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        summary: item.summary,
        author: item.author,
        entities: item.entities,
        signals: item.signals,
        tags: item.tags,
        publishedAt: item.publishedAt.toISOString(),
        ingestedAt: item.ingestedAt.toISOString(),
        source: {
          name: item.source.name,
          category: item.source.category,
          subcategory: item.source.subcategory,
        },
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      filters: {
        keyword: keyword ?? null,
        category: category ?? null,
        signal: signal ?? null,
        entity: entity ?? null,
        dateFrom: dateFrom.toISOString().slice(0, 10),
        dateTo: dateTo.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to search feed items: ${message}` },
      { status: 500 },
    );
  }
}
