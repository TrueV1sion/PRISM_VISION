// src/lib/signals/correlator.ts
/**
 * SignalCorrelator — Cross-Source Temporal Pattern Detection
 *
 * The main engine that:
 * 1. Queries recent FeedItems, DatasetDeltas, and ToolCallLogs within a time window
 * 2. For each pattern, checks if matching sources exist within the pattern's window
 * 3. Matches sources by keyword overlap with pattern keywords
 * 4. Groups matching sources by entity (entityRefs from FeedItem.entities, DatasetDelta.entityKey)
 * 5. When minSources threshold is met, creates a correlation candidate
 */

import { prisma } from "@/lib/prisma";
import { CORRELATION_PATTERNS, type CorrelationPattern } from "./patterns";
import { computeConfidence } from "./scorer";

export interface CorrelationCandidate {
  pattern: CorrelationPattern;
  matchedSources: {
    type: string;
    id: string;
    timestamp: Date;
    entity?: string;
  }[];
  entityRefs: string[];
  confidence: number;
  maxTimeDeltaHours: number;
}

export class SignalCorrelator {
  /** Run correlation against recent data within windowHours. */
  async correlate(
    windowHours: number = 24,
  ): Promise<CorrelationCandidate[]> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    // Fetch recent data from all source types in parallel
    const [feedItems, datasetDeltas, toolCallLogs] = await Promise.all([
      prisma.feedItem.findMany({
        where: { publishedAt: { gte: since } },
        select: {
          id: true,
          title: true,
          entities: true,
          signals: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: "desc" },
        take: 500,
      }),
      prisma.datasetDelta.findMany({
        where: { detectedAt: { gte: since } },
        select: {
          id: true,
          entityKey: true,
          changeType: true,
          detectedAt: true,
          snapshotId: true,
        },
        orderBy: { detectedAt: "desc" },
        take: 500,
      }),
      prisma.toolCallLog.findMany({
        where: { capturedAt: { gte: since } },
        select: {
          id: true,
          toolName: true,
          toolParams: true,
          capturedAt: true,
        },
        orderBy: { capturedAt: "desc" },
        take: 200,
      }),
    ]);

    const candidates: CorrelationCandidate[] = [];

    for (const pattern of CORRELATION_PATTERNS) {
      // Filter by window specific to this pattern
      const patternSince = new Date(
        Date.now() - pattern.windowHours * 60 * 60 * 1000,
      );

      const matchedSources: CorrelationCandidate["matchedSources"] = [];
      const entityRefs = new Set<string>();

      // Match feed items by keyword
      if (pattern.sourceTypes.includes("feed")) {
        for (const item of feedItems) {
          if (item.publishedAt < patternSince) continue;
          const titleLower = item.title.toLowerCase();
          const matchesKeyword = pattern.keywords.some((kw) =>
            titleLower.includes(kw.toLowerCase()),
          );
          const matchesSignal = item.signals.some((s) =>
            s.toLowerCase().includes(pattern.signalType),
          );
          if (matchesKeyword || matchesSignal) {
            matchedSources.push({
              type: "feed",
              id: item.id,
              timestamp: item.publishedAt,
              entity: item.entities[0],
            });
            item.entities.forEach((e) => entityRefs.add(e));
          }
        }
      }

      // Match dataset deltas by keyword in entityKey
      if (pattern.sourceTypes.includes("dataset_delta")) {
        for (const delta of datasetDeltas) {
          if (delta.detectedAt < patternSince) continue;
          const entityLower = delta.entityKey.toLowerCase();
          const matchesKeyword = pattern.keywords.some((kw) =>
            entityLower.includes(kw.toLowerCase()),
          );
          if (matchesKeyword || delta.changeType === "removed") {
            matchedSources.push({
              type: "dataset_delta",
              id: delta.id,
              timestamp: delta.detectedAt,
              entity: delta.entityKey,
            });
            entityRefs.add(delta.entityKey);
          }
        }
      }

      // Match tool call logs by keyword in toolParams
      if (pattern.sourceTypes.includes("tool_call")) {
        for (const log of toolCallLogs) {
          if (log.capturedAt < patternSince) continue;
          const inputStr =
            typeof log.toolParams === "string"
              ? log.toolParams
              : JSON.stringify(log.toolParams);
          const matchesKeyword = pattern.keywords.some((kw) =>
            inputStr.toLowerCase().includes(kw.toLowerCase()),
          );
          if (matchesKeyword) {
            matchedSources.push({
              type: "tool_call",
              id: log.id,
              timestamp: log.capturedAt,
            });
          }
        }
      }

      // Check if minimum sources are met
      if (matchedSources.length >= pattern.minSources) {
        // Calculate max time delta between matched sources
        const timestamps = matchedSources.map((s) => s.timestamp.getTime());
        const maxTimeDelta =
          (Math.max(...timestamps) - Math.min(...timestamps)) /
          (1000 * 60 * 60);

        const confidence = computeConfidence({
          baseConfidence: pattern.baseConfidence,
          sourceCount: matchedSources.length,
          minSources: pattern.minSources,
          maxTimeDeltaHours: maxTimeDelta,
          windowHours: pattern.windowHours,
          entityMatchStrength: entityRefs.size > 0 ? "partial" : "keyword",
        });

        candidates.push({
          pattern,
          matchedSources,
          entityRefs: Array.from(entityRefs),
          confidence,
          maxTimeDeltaHours: maxTimeDelta,
        });
      }
    }

    return candidates;
  }
}
