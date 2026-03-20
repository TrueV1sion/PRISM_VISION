// src/lib/data-sources/tools/feed-search.tools.ts
/**
 * Feed Search — Layer 2 Granular Tool
 *
 * Queries the FeedItem table with keyword, category, signal type,
 * and date range filters. Returns markdown-formatted results with
 * entity and signal annotations.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { MAX_TABLE_ROWS_LAYER_2 } from "../types";
import {
  markdownTable,
  formatCitations,
  formatNumber,
  formatDate,
} from "../format";

// ─── search_feed_items ─────────────────────────────────────────

const searchFeedItems: DataSourceTool = {
  name: "search_feed_items",
  description:
    "Search healthcare news feed items by keyword, category, signal type, or date range. " +
    "Returns recent articles from 28 RSS sources including FDA, CMS, Congress, industry publications, and research journals. " +
    "Useful for current events, regulatory changes, M&A activity, and industry trends.",
  inputSchema: {
    type: "object",
    properties: {
      keyword: {
        type: "string",
        description: "Search keyword to match against title and summary",
      },
      category: {
        type: "string",
        description: "Feed category filter: regulatory, legislative, industry, research, ma-payer, innovation",
      },
      signal: {
        type: "string",
        description:
          "Signal type filter: drug_approval, regulatory_change, ma_activity, funding_round, " +
          "leadership_change, clinical_trial, safety_alert, coverage_decision, legislative_action, " +
          "enforcement_action, pricing_change, partnership, market_entry, facility_change, patent_event",
      },
      entity: {
        type: "string",
        description: "Filter by entity name (company, drug, agency)",
      },
      date_from: {
        type: "string",
        description: "Start date (YYYY-MM-DD). Defaults to 7 days ago.",
      },
      date_to: {
        type: "string",
        description: "End date (YYYY-MM-DD). Defaults to today.",
      },
      limit: {
        type: "number",
        description: "Max results (default 15, max 50)",
      },
    },
  },
  layer: 2,
  sources: ["feed-items"],
  routingTags: ["news", "rss", "monitoring", "signal", "intelligence"],

  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const { prisma } = await import("@/lib/prisma");

    const keyword = input.keyword as string | undefined;
    const category = input.category as string | undefined;
    const signal = input.signal as string | undefined;
    const entity = input.entity as string | undefined;
    const limit = Math.min((input.limit as number | undefined) ?? 15, 50);

    // Date range defaults to last 7 days
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const dateFrom = input.date_from
      ? new Date(input.date_from as string)
      : defaultFrom;
    const dateTo = input.date_to
      ? new Date(input.date_to as string)
      : now;

    try {
      // Build Prisma where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        publishedAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      };

      // Category filter — join through FeedSource
      if (category) {
        where.source = { category };
      }

      // Signal filter — array contains
      if (signal) {
        where.signals = { has: signal };
      }

      // Entity filter — array contains
      if (entity) {
        where.entities = { has: entity };
      }

      // Keyword filter — search title and summary
      if (keyword) {
        where.OR = [
          { title: { contains: keyword, mode: "insensitive" } },
          { summary: { contains: keyword, mode: "insensitive" } },
        ];
      }

      // Query with count
      const [items, totalCount] = await Promise.all([
        prisma.feedItem.findMany({
          where,
          include: { source: { select: { name: true, category: true } } },
          orderBy: { publishedAt: "desc" },
          take: limit,
        }),
        prisma.feedItem.count({ where }),
      ]);

      // Format results
      const headers = ["Date", "Source", "Title", "Signals"];
      const rows = items.map((item) => [
        formatDate(item.publishedAt.toISOString()),
        item.source.name,
        item.title.slice(0, 70) + (item.title.length > 70 ? "..." : ""),
        item.signals.slice(0, 2).join(", ") || "—",
      ]);

      const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, totalCount);

      // Build detail section for top items
      const details: string[] = [];
      for (const item of items.slice(0, 5)) {
        const entityList = item.entities.length > 0
          ? `**Entities**: ${item.entities.slice(0, 5).join(", ")}`
          : "";
        const signalList = item.signals.length > 0
          ? `**Signals**: ${item.signals.join(", ")}`
          : "";

        details.push(
          [
            `### ${item.title.slice(0, 100)}`,
            `*${item.source.name}* | ${formatDate(item.publishedAt.toISOString())}`,
            item.summary ? item.summary.slice(0, 300) : "",
            entityList,
            signalList,
            `[Link](${item.url})`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }

      // Build query description
      const queryParts: string[] = [];
      if (keyword) queryParts.push(keyword);
      if (category) queryParts.push(`category:${category}`);
      if (signal) queryParts.push(`signal:${signal}`);
      if (entity) queryParts.push(`entity:${entity}`);
      const queryDesc = queryParts.length > 0 ? queryParts.join(" + ") : "all recent";

      const citation = {
        id: `[FEED-${Date.now()}]`,
        source: "Protoprism Feed Ingestion",
        query: queryDesc,
        dateRange: `${dateFrom.toISOString().slice(0, 10)} to ${dateTo.toISOString().slice(0, 10)}`,
        resultCount: totalCount,
      };

      const content = [
        `## Feed Items: ${queryDesc}`,
        `**${formatNumber(totalCount)} items** found (${dateFrom.toISOString().slice(0, 10)} to ${dateTo.toISOString().slice(0, 10)})`,
        table,
        "",
        ...details,
      ].join("\n\n");

      return {
        content: `${content}\n\n${formatCitations([citation])}`,
        citations: [citation],
        vintage: {
          queriedAt: new Date().toISOString(),
          source: "Protoprism Feed Ingestion (28 RSS sources)",
        },
        confidence: totalCount > 0 ? "HIGH" : "LOW",
        truncated: items.length < totalCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `## Feed Search Error\n\nFailed to search feed items: ${message}\n\nThis may indicate the feed ingestion pipeline has not yet run. Check that the cron job at \`/api/cron/feeds\` is active.`,
        citations: [],
        vintage: {
          queriedAt: new Date().toISOString(),
          source: "Protoprism Feed Ingestion",
        },
        confidence: "LOW",
        truncated: false,
      };
    }
  },
};

// ─── Export ──────────────────────────────────────────────────

export const feedSearchTools: DataSourceTool[] = [searchFeedItems];
