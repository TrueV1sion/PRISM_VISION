// src/lib/data-sources/research/cross-source-correlation.ts
/**
 * research_cross_source_patterns — Layer 3 Intelligence Tool
 *
 * Compound research tool that aggregates recent signals by entity or
 * keyword, counts by signal type, lists active alerts, and returns
 * a cross-referenced intelligence packet for temporal pattern analysis.
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

export const crossSourceCorrelationResearchTool: DataSourceTool = {
  name: "research_cross_source_patterns",
  description:
    "Cross-source correlation intelligence: aggregates signals detected by SENTINEL " +
    "from feeds, dataset deltas, and tool calls. Shows signal type distribution, " +
    "active alerts, entity-linked patterns, and temporal clustering analysis. " +
    "Use to understand emerging cross-source patterns around a topic or entity.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Entity, topic, or keyword to research across signals",
      },
      timeframe: {
        type: "string",
        description: "How far back to search: '7d', '14d', '30d', '90d' (default '30d')",
      },
      focus: {
        type: "string",
        description:
          "Optional focus: 'ma', 'regulatory', 'quality', 'safety', 'innovation', 'payer'",
      },
    },
    required: ["query"],
  },
  layer: 3,
  sources: ["signals", "alerts"],
  routingTags: ["signal", "correlation", "sentinel", "cross-source", "monitoring"],

  handler: async (
    input: Record<string, unknown>,
    _cache: ToolCache,
  ): Promise<ToolResult> => {
    const { prisma } = await import("@/lib/prisma");

    const query = input.query as string;
    const timeframe = (input.timeframe as string) ?? "30d";
    const focus = input.focus as string | undefined;

    // Calculate date range
    const now = new Date();
    const daysBack = parseInt(timeframe) || 30;
    const dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - daysBack);

    // ─── Build signal filter ────────────────────────────────────
    const signalWhere: Record<string, unknown> = {
      detectedAt: { gte: dateFrom },
      OR: [
        { entityRefs: { has: query } },
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    };

    // Map focus to signal types
    const focusTypeMap: Record<string, string[]> = {
      ma: ["ma_indicator", "provider_consolidation"],
      regulatory: ["regulatory_shift", "legislative_momentum"],
      quality: ["quality_disruption"],
      safety: ["drug_safety_escalation"],
      innovation: ["market_entry", "innovation_cluster"],
      payer: ["payer_strategy_shift"],
    };
    if (focus && focusTypeMap[focus]) {
      signalWhere.signalType = { in: focusTypeMap[focus] };
    }

    // ─── Parallel queries ────────────────────────────────────────
    const [signals, pendingAlerts, allSignalTypes] = await Promise.all([
      prisma.signal.findMany({
        where: signalWhere,
        orderBy: { detectedAt: "desc" },
        take: 50,
        include: { alerts: { select: { id: true, acknowledged: true } } },
      }),
      prisma.alert.findMany({
        where: {
          acknowledged: false,
          createdAt: { gte: dateFrom },
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { message: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          signal: { select: { id: true, signalType: true } },
        },
      }),
      // Count signals by type for distribution
      prisma.signal.groupBy({
        by: ["signalType"],
        where: { detectedAt: { gte: dateFrom } },
        _count: { signalType: true },
        orderBy: { _count: { signalType: "desc" } },
      }),
    ]);

    // ─── Confidence scoring ─────────────────────────────────────
    let sourcesReturned = 0;
    const sourcesQueried = 3;
    if (signals.length > 0) sourcesReturned++;
    if (pendingAlerts.length > 0) sourcesReturned++;
    if (allSignalTypes.length > 0) sourcesReturned++;

    const confidence: "HIGH" | "MEDIUM" | "LOW" =
      sourcesReturned >= 2 ? "HIGH" : sourcesReturned >= 1 ? "MEDIUM" : "LOW";

    // ─── Build intelligence packet ──────────────────────────────
    const sections: string[] = [];

    sections.push(
      intelligenceHeader({
        topic: "Cross-Source Correlation",
        subject: query,
        confidence,
        sourcesQueried,
        sourcesReturned,
        vintage: now.toISOString().slice(0, 10),
      }),
    );

    // Key Intelligence bullets
    const bullets: string[] = [];
    bullets.push(
      `- **${formatNumber(signals.length)}** correlation signals detected in the last ${daysBack} days`,
    );
    if (pendingAlerts.length > 0) {
      bullets.push(
        `- **${pendingAlerts.length}** unacknowledged alerts requiring attention`,
      );
    }

    // Severity distribution
    const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const s of signals) {
      sevCounts[s.severity as keyof typeof sevCounts]++;
    }
    if (sevCounts.critical > 0 || sevCounts.high > 0) {
      bullets.push(
        `- Severity breakdown: ${sevCounts.critical} critical, ${sevCounts.high} high, ${sevCounts.medium} medium, ${sevCounts.low} low`,
      );
    }

    // Entity frequency
    const entityFreq = new Map<string, number>();
    for (const s of signals) {
      for (const e of s.entityRefs) {
        entityFreq.set(e, (entityFreq.get(e) ?? 0) + 1);
      }
    }
    const topEntities = Array.from(entityFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (topEntities.length > 0) {
      bullets.push(
        `- Top entities: ${topEntities.map(([e, c]) => `${e} (${c})`).join(", ")}`,
      );
    }

    sections.push(`### Key Intelligence\n${bullets.join("\n")}`);

    // Signal type distribution table
    if (allSignalTypes.length > 0) {
      const typeRows = allSignalTypes.map((t) => [
        t.signalType,
        formatNumber(t._count.signalType),
      ]);
      sections.push(
        `### Signal Type Distribution (Last ${daysBack} Days)\n${markdownTable(["Signal Type", "Count"], typeRows, 10, allSignalTypes.length)}`,
      );
    }

    // Recent signals table
    if (signals.length > 0) {
      const signalRows = signals.slice(0, 10).map((s) => [
        s.signalType,
        s.title.slice(0, 50),
        s.severity,
        `${(s.confidence * 100).toFixed(0)}%`,
        s.detectedAt.toISOString().slice(0, 10),
      ]);
      sections.push(
        `### Recent Signals Matching "${query}"\n${markdownTable(["Type", "Title", "Severity", "Confidence", "Detected"], signalRows, 10, signals.length)}`,
      );
    }

    // Active alerts summary
    if (pendingAlerts.length > 0) {
      const alertRows = pendingAlerts.slice(0, 5).map((a) => [
        a.title.slice(0, 50),
        a.severity,
        a.alertType,
        a.signal?.signalType ?? "--",
        a.createdAt.toISOString().slice(0, 10),
      ]);
      sections.push(
        `### Active Alerts\n${markdownTable(["Title", "Severity", "Type", "Signal", "Created"], alertRows, 5, pendingAlerts.length)}`,
      );
    }

    // ─── Citations ──────────────────────────────────────────────
    const citations = [
      {
        id: `[SIGNAL-CORR-${Date.now()}]`,
        source: "SENTINEL Signal Engine",
        query,
        resultCount: signals.length,
      },
      {
        id: `[ALERT-CORR-${Date.now()}]`,
        source: "SENTINEL Alert System",
        query,
        resultCount: pendingAlerts.length,
      },
    ];

    sections.push(formatCitations(citations));

    // Assemble and truncate
    const rawContent = sections.join("\n\n");
    const { content, truncated } = truncateToCharBudget(
      rawContent,
      LAYER_3_CHAR_BUDGET,
    );

    return {
      content,
      citations,
      vintage: {
        queriedAt: now.toISOString(),
        source: "SENTINEL Signal Engine",
      },
      confidence,
      truncated,
    };
  },
};
