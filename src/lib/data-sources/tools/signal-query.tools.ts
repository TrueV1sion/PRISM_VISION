// src/lib/data-sources/tools/signal-query.tools.ts
/**
 * Signal Query — Layer 2 Granular Tools
 *
 * Two tools for querying the Signal and Alert tables:
 * - search_signals: query Signal records by type, severity, entity, date range
 * - search_alerts: query Alert records by type, severity, acknowledged status
 *
 * Both use lazy Prisma imports to avoid build-time database coupling.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { MAX_TABLE_ROWS_LAYER_2 } from "../types";
import {
  markdownTable,
  formatCitations,
  formatNumber,
} from "../format";

// ─── search_signals ──────────────────────────────────────────

const searchSignals: DataSourceTool = {
  name: "search_signals",
  description:
    "Search cross-source correlation signals detected by the SENTINEL monitoring engine. " +
    "Query by signal type (ma_indicator, regulatory_shift, market_entry, etc.), severity, " +
    "entity name, or date range. Returns detected patterns with confidence scores and source references.",
  inputSchema: {
    type: "object",
    properties: {
      signal_type: {
        type: "string",
        description:
          "Signal type filter: ma_indicator, regulatory_shift, market_entry, " +
          "provider_consolidation, quality_disruption, drug_safety_escalation, " +
          "legislative_momentum, workforce_disruption, payer_strategy_shift, innovation_cluster",
      },
      severity: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Filter by severity level",
      },
      entity: {
        type: "string",
        description: "Filter by entity reference (company, provider, drug name)",
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
  sources: ["signals"],
  routingTags: ["signal", "correlation", "sentinel", "monitoring", "cross-source"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const { prisma } = await import("@/lib/prisma");

    const signalType = input.signal_type as string | undefined;
    const severity = input.severity as string | undefined;
    const entity = input.entity as string | undefined;
    const limit = Math.min((input.limit as number | undefined) ?? 15, 50);

    // Date range
    const now = new Date();
    const dateFrom = input.date_from
      ? new Date(input.date_from as string)
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateTo = input.date_to ? new Date(input.date_to as string) : now;

    const where: Record<string, unknown> = {
      detectedAt: { gte: dateFrom, lte: dateTo },
    };
    if (signalType) where.signalType = signalType;
    if (severity) where.severity = severity;
    if (entity) where.entityRefs = { has: entity };

    const [signals, total] = await Promise.all([
      prisma.signal.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        take: limit,
        include: { alerts: { select: { id: true, acknowledged: true } } },
      }),
      prisma.signal.count({ where }),
    ]);

    const headers = ["Type", "Title", "Severity", "Confidence", "Entities", "Detected"];
    const rows = signals.map((s) => [
      s.signalType,
      s.title.slice(0, 60),
      s.severity,
      `${(s.confidence * 100).toFixed(0)}%`,
      s.entityRefs.slice(0, 2).join(", ") || "--",
      s.detectedAt.toISOString().slice(0, 10),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, total);
    const queryDesc = signalType ?? entity ?? severity ?? "all signals";

    const citation = {
      id: `[SIGNAL-${Date.now()}]`,
      source: "SENTINEL Signal Engine",
      query: queryDesc,
      resultCount: total,
    };

    return {
      content:
        `## Signals: ${queryDesc}\n\n` +
        `**${formatNumber(total)} signals detected** (${dateFrom.toISOString().slice(0, 10)} to ${dateTo.toISOString().slice(0, 10)})\n\n` +
        `${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: {
        queriedAt: now.toISOString(),
        source: "SENTINEL Signal Engine",
      },
      confidence: total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < total,
    };
  },
};

// ─── search_alerts ──────────────────────────────────────────

const searchAlerts: DataSourceTool = {
  name: "search_alerts",
  description:
    "Search SENTINEL alerts triggered by cross-source signal detection. " +
    "Query by alert type (signal, threshold, anomaly, scheduled), severity, " +
    "or acknowledgement status. Returns alerts with linked signal details.",
  inputSchema: {
    type: "object",
    properties: {
      alert_type: {
        type: "string",
        enum: ["signal", "threshold", "anomaly", "scheduled"],
        description: "Alert type filter",
      },
      severity: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Filter by severity level",
      },
      acknowledged: {
        type: "boolean",
        description: "Filter by acknowledgement status (true/false)",
      },
      limit: {
        type: "number",
        description: "Max results (default 15, max 50)",
      },
    },
  },
  layer: 2,
  sources: ["alerts"],
  routingTags: ["alert", "sentinel", "monitoring", "notification"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const { prisma } = await import("@/lib/prisma");

    const alertType = input.alert_type as string | undefined;
    const severity = input.severity as string | undefined;
    const acknowledged = input.acknowledged as boolean | undefined;
    const limit = Math.min((input.limit as number | undefined) ?? 15, 50);

    const where: Record<string, unknown> = {};
    if (alertType) where.alertType = alertType;
    if (severity) where.severity = severity;
    if (acknowledged !== undefined) where.acknowledged = acknowledged;

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          signal: { select: { id: true, signalType: true, title: true } },
        },
      }),
      prisma.alert.count({ where }),
    ]);

    const headers = ["Title", "Type", "Severity", "Acknowledged", "Signal", "Created"];
    const rows = alerts.map((a) => [
      a.title.slice(0, 50),
      a.alertType,
      a.severity,
      a.acknowledged ? "Yes" : "No",
      a.signal?.signalType ?? "--",
      a.createdAt.toISOString().slice(0, 10),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, total);
    const queryDesc = alertType ?? severity ?? "all alerts";

    const citation = {
      id: `[ALERT-${Date.now()}]`,
      source: "SENTINEL Alert System",
      query: queryDesc,
      resultCount: total,
    };

    const now = new Date();
    return {
      content:
        `## Alerts: ${queryDesc}\n\n` +
        `**${formatNumber(total)} alerts found**\n\n` +
        `${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: {
        queriedAt: now.toISOString(),
        source: "SENTINEL Alert System",
      },
      confidence: total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < total,
    };
  },
};

// ─── Export ──────────────────────────────────────────────────

export const signalQueryTools: DataSourceTool[] = [
  searchSignals,
  searchAlerts,
];
