// src/lib/data-sources/research/news-intelligence.ts
/**
 * research_news_intelligence — Layer 3 Intelligence Tool
 *
 * Aggregates feed search results with entity correlation and signal
 * pattern analysis to produce a news intelligence packet. Combines
 * multiple feed queries in parallel to build a comprehensive picture
 * of recent activity around a topic.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { LAYER_3_CHAR_BUDGET } from "../types";
import {
  intelligenceHeader,
  markdownTable,
  formatCitations,
  formatNumber,
  truncateToCharBudget,
} from "../format";

export const newsIntelligenceResearchTool: DataSourceTool = {
  name: "research_news_intelligence",
  description:
    "News intelligence research: aggregates recent healthcare news from 28 RSS sources, " +
    "correlates entities (companies, drugs, agencies), and identifies signal patterns " +
    "(approvals, M&A, regulatory changes, clinical trials). Makes multiple feed queries " +
    "and returns a cross-referenced intelligence packet.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Topic, company, drug, or entity to research",
      },
      timeframe: {
        type: "string",
        description: "How far back to search: '7d', '14d', '30d' (default '14d')",
      },
      focus: {
        type: "string",
        description: "Optional focus: 'regulatory', 'industry', 'research', 'legislative', 'ma-payer', 'innovation'",
      },
    },
    required: ["query"],
  },
  layer: 3,
  sources: ["feed-items", "entity-extraction"],
  routingTags: ["news", "rss", "monitoring", "signal", "intelligence"],

  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const { prisma } = await import("@/lib/prisma");

    const query = input.query as string;
    const timeframe = (input.timeframe as string) ?? "14d";
    const focus = input.focus as string | undefined;

    // Calculate date range
    const now = new Date();
    const daysBack = parseInt(timeframe) || 14;
    const dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - daysBack);

    try {
      // ─── Parallel queries ──────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseWhere: Record<string, any> = {
        publishedAt: { gte: dateFrom, lte: now },
      };

      if (focus) {
        baseWhere.source = { category: focus };
      }

      // Query 1: Keyword matches in title/summary
      const keywordWhere = {
        ...baseWhere,
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { summary: { contains: query, mode: "insensitive" as const } },
        ],
      };

      // Query 2: Entity matches
      const entityWhere = {
        ...baseWhere,
        entities: { has: query },
      };

      const [
        keywordItems,
        entityItems,
        keywordCount,
        entityCount,
        signalCounts,
        sourceCounts,
      ] = await Promise.all([
        prisma.feedItem.findMany({
          where: keywordWhere,
          include: { source: { select: { name: true, category: true } } },
          orderBy: { publishedAt: "desc" },
          take: 20,
        }),
        prisma.feedItem.findMany({
          where: entityWhere,
          include: { source: { select: { name: true, category: true } } },
          orderBy: { publishedAt: "desc" },
          take: 10,
        }),
        prisma.feedItem.count({ where: keywordWhere }),
        prisma.feedItem.count({ where: entityWhere }),
        // Aggregate signal distribution for keyword matches
        prisma.feedItem.findMany({
          where: keywordWhere,
          select: { signals: true },
        }),
        // Aggregate source distribution
        prisma.feedItem.findMany({
          where: keywordWhere,
          select: { source: { select: { category: true } } },
        }),
      ]);

      // ─── Deduplicate items ─────────────────────────────────────
      const seenUrls = new Set<string>();
      const allItems = [...keywordItems, ...entityItems].filter((item) => {
        if (seenUrls.has(item.url)) return false;
        seenUrls.add(item.url);
        return true;
      });

      const totalUnique = allItems.length;

      // ─── Signal distribution analysis ──────────────────────────
      const signalDistribution = new Map<string, number>();
      for (const item of signalCounts) {
        for (const signal of item.signals) {
          signalDistribution.set(signal, (signalDistribution.get(signal) ?? 0) + 1);
        }
      }
      const topSignals = [...signalDistribution.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      // ─── Category distribution analysis ────────────────────────
      const categoryDistribution = new Map<string, number>();
      for (const item of sourceCounts) {
        const cat = item.source.category;
        categoryDistribution.set(cat, (categoryDistribution.get(cat) ?? 0) + 1);
      }
      const topCategories = [...categoryDistribution.entries()]
        .sort((a, b) => b[1] - a[1]);

      // ─── Entity co-occurrence analysis ─────────────────────────
      const entityFrequency = new Map<string, number>();
      for (const item of allItems) {
        for (const entity of item.entities) {
          if (entity.toLowerCase() !== query.toLowerCase()) {
            entityFrequency.set(entity, (entityFrequency.get(entity) ?? 0) + 1);
          }
        }
      }
      const topCorrelated = [...entityFrequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // ─── Confidence scoring ────────────────────────────────────
      const sourcesQueried = 2; // keyword + entity queries
      let sourcesReturned = 0;
      if (keywordCount > 0) sourcesReturned++;
      if (entityCount > 0) sourcesReturned++;

      const confidence: "HIGH" | "MEDIUM" | "LOW" =
        totalUnique >= 5 ? "HIGH" : totalUnique >= 2 ? "MEDIUM" : "LOW";

      // ─── Build intelligence packet ─────────────────────────────
      const sections: string[] = [];

      sections.push(intelligenceHeader({
        topic: "News Intelligence",
        subject: query,
        confidence,
        sourcesQueried,
        sourcesReturned,
        vintage: now.toISOString().slice(0, 10),
      }));

      // Key Intelligence bullets
      const bullets: string[] = [];
      bullets.push(`- **${formatNumber(keywordCount)}** keyword matches across 28 RSS sources (last ${daysBack} days)`);
      if (entityCount > 0) {
        bullets.push(`- **${formatNumber(entityCount)}** items with direct entity reference`);
      }
      if (topSignals.length > 0) {
        const signalSummary = topSignals.slice(0, 3).map(([s, c]) => `${s} (${c})`).join(", ");
        bullets.push(`- **Top signals**: ${signalSummary}`);
      }
      if (topCorrelated.length > 0) {
        const correlatedSummary = topCorrelated.slice(0, 4).map(([e]) => e).join(", ");
        bullets.push(`- **Correlated entities**: ${correlatedSummary}`);
      }
      if (topCategories.length > 0) {
        const catSummary = topCategories.slice(0, 3).map(([c, n]) => `${c} (${n})`).join(", ");
        bullets.push(`- **Source categories**: ${catSummary}`);
      }
      sections.push(`### Key Intelligence\n${bullets.join("\n")}`);

      // Signal Distribution table
      if (topSignals.length > 0) {
        const signalRows = topSignals.map(([signal, count]) => [
          signal.replace(/_/g, " "),
          String(count),
        ]);
        sections.push(`### Signal Distribution\n${markdownTable(["Signal Type", "Count"], signalRows, 8)}`);
      }

      // Correlated Entities table
      if (topCorrelated.length > 0) {
        const entityRows = topCorrelated.map(([entity, count]) => [
          entity,
          String(count),
        ]);
        sections.push(`### Correlated Entities\n${markdownTable(["Entity", "Mentions"], entityRows, 10)}`);
      }

      // Recent Headlines
      if (allItems.length > 0) {
        const headlineRows = allItems.slice(0, 8).map((item) => [
          item.publishedAt.toISOString().slice(0, 10),
          item.source.name,
          item.title.slice(0, 60) + (item.title.length > 60 ? "..." : ""),
          item.signals.slice(0, 2).join(", ") || "—",
        ]);
        sections.push(
          `### Recent Headlines\n${markdownTable(["Date", "Source", "Title", "Signals"], headlineRows, 8, totalUnique)}`,
        );
      }

      // ─── Citations ─────────────────────────────────────────────
      const ts = Date.now();
      const citations = [
        {
          id: `[FEED-KW-${ts}]`,
          source: "Protoprism Feed Ingestion (keyword search)",
          query,
          dateRange: `${dateFrom.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}`,
          resultCount: keywordCount,
        },
        {
          id: `[FEED-ENT-${ts}]`,
          source: "Protoprism Feed Ingestion (entity match)",
          query,
          dateRange: `${dateFrom.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}`,
          resultCount: entityCount,
        },
      ];

      sections.push(formatCitations(citations));

      const rawContent = sections.join("\n\n");
      const { content, truncated } = truncateToCharBudget(rawContent, LAYER_3_CHAR_BUDGET);

      return {
        content,
        citations,
        vintage: {
          queriedAt: now.toISOString(),
          source: "Protoprism Feed Ingestion (28 RSS sources)",
        },
        confidence,
        truncated,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `## News Intelligence Error\n\nFailed to aggregate news intelligence for "${query}": ${message}\n\nThis may indicate the feed ingestion pipeline has not yet run. Check that the cron job at \`/api/cron/feeds\` is active.`,
        citations: [],
        vintage: {
          queriedAt: now.toISOString(),
          source: "Protoprism Feed Ingestion",
        },
        confidence: "LOW",
        truncated: false,
      };
    }
  },
};
