/**
 * Feed Ingestor — Core Ingestion Pipeline
 *
 * Orchestrates the full feed ingestion cycle:
 * 1. Seed/sync FeedSource records from FEED_REGISTRY
 * 2. For each enabled source due for polling: fetch -> parse -> dedup -> extract -> classify -> persist
 * 3. Return ingestion statistics
 *
 * Uses the shared Prisma singleton from src/lib/prisma.ts.
 */

import crypto from "crypto";
import { FEED_REGISTRY } from "./registry";
import { parseFeed } from "./parser";
import { extractEntities } from "./entity-extractor";
import { classifySignals } from "./signal-classifier";

/** Generate a deterministic content hash for deduplication */
function contentHash(title: string, url: string): string {
  return crypto.createHash("sha256").update(`${title}|${url}`).digest("hex");
}

export interface IngestResult {
  status: "ok" | "partial" | "error";
  sourcesPolled: number;
  processed: number;
  newItems: number;
  errors: string[];
  durationMs?: number;
}

/**
 * Ingest all enabled feeds that are due for polling.
 *
 * A source is "due" if it has never been polled, or if
 * (now - lastPolledAt) >= pollIntervalHours.
 */
export async function ingestAllFeeds(): Promise<IngestResult> {
  // Lazy import to avoid importing Prisma at module load time
  const { prisma } = await import("@/lib/prisma");

  const startTime = Date.now();
  const errors: string[] = [];
  let totalProcessed = 0;
  let totalNewItems = 0;

  try {
    // ─── Step 1: Seed/sync FeedSource records ────────────────
    await seedFeedSources(prisma);

    // ─── Step 2: Find sources due for polling ────────────────
    const now = new Date();
    const sources = await prisma.feedSource.findMany({
      where: { enabled: true },
    });

    const dueSources = sources.filter((source) => {
      if (!source.lastPolledAt) return true;
      const hoursSinceLastPoll =
        (now.getTime() - source.lastPolledAt.getTime()) / (1000 * 60 * 60);
      return hoursSinceLastPoll >= source.pollIntervalHours;
    });

    // ─── Step 3: Process each due source ─────────────────────
    // Process sequentially to avoid overwhelming feed servers
    for (const source of dueSources) {
      try {
        const result = await ingestSingleSource(prisma, source.id, source.url);
        totalProcessed++;
        totalNewItems += result.newItems;

        // Update last polled timestamp
        await prisma.feedSource.update({
          where: { id: source.id },
          data: { lastPolledAt: now, lastError: null },
        });
      } catch (error) {
        const message = `[${source.name}] ${error instanceof Error ? error.message : String(error)}`;
        errors.push(message);
        console.error(`[feeds/ingestor] Error ingesting ${source.name}:`, error);

        // Record error on source but don't stop the pipeline
        await prisma.feedSource.update({
          where: { id: source.id },
          data: {
            lastPolledAt: now,
            lastError: message.slice(0, 500),
          },
        });
      }
    }

    return {
      status: errors.length === 0 ? "ok" : "partial",
      sourcesPolled: dueSources.length,
      processed: totalProcessed,
      newItems: totalNewItems,
      errors,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      sourcesPolled: 0,
      processed: totalProcessed,
      newItems: totalNewItems,
      errors: [message],
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Ingest a single feed source by its database ID.
 * Useful for manual re-ingestion or webhook-triggered updates.
 */
export async function ingestFeed(sourceId: string): Promise<{ newItems: number }> {
  const { prisma } = await import("@/lib/prisma");

  const source = await prisma.feedSource.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new Error(`Feed source not found: ${sourceId}`);
  }

  const result = await ingestSingleSource(prisma, source.id, source.url);

  await prisma.feedSource.update({
    where: { id: sourceId },
    data: { lastPolledAt: new Date(), lastError: null },
  });

  return result;
}

// ─── Internal Helpers ──────────────────────────────────────────

type PrismaModule = typeof import("@/lib/prisma");
type PrismaInstance = Awaited<PrismaModule>["prisma"];

/**
 * Seed FeedSource records from the static FEED_REGISTRY.
 * Uses upsert to avoid duplicates and update names/categories on re-seed.
 */
async function seedFeedSources(prisma: PrismaInstance): Promise<void> {
  for (const config of FEED_REGISTRY) {
    await prisma.feedSource.upsert({
      where: { url: config.url },
      update: {
        name: config.name,
        feedType: config.feedType === "google-news" ? "google_news_proxy" : config.feedType,
        category: config.category,
        subcategory: config.subcategory ?? null,
        pollIntervalHours: config.pollIntervalHours,
      },
      create: {
        url: config.url,
        name: config.name,
        feedType: config.feedType === "google-news" ? "google_news_proxy" : config.feedType,
        category: config.category,
        subcategory: config.subcategory ?? null,
        pollIntervalHours: config.pollIntervalHours,
        enabled: true,
      },
    });
  }
}

/**
 * Ingest a single feed: fetch -> parse -> dedup -> extract -> classify -> persist.
 */
async function ingestSingleSource(
  prisma: PrismaInstance,
  sourceId: string,
  feedUrl: string,
): Promise<{ newItems: number }> {
  // Step 1: Fetch and parse the feed
  const items = await parseFeed(feedUrl);
  if (items.length === 0) {
    return { newItems: 0 };
  }

  // Step 2: Build feed item records with entity extraction and signal classification
  const feedItemRecords = items.map((item) => {
    const combinedText = `${item.title} ${item.summary}`;
    const entities = extractEntities(combinedText);
    const signals = classifySignals(item.title, item.summary, entities);

    // Flatten entities into a single tag-like array for the entities column
    const entityNames = [
      ...entities.companies,
      ...entities.drugs,
      ...entities.agencies,
    ];

    // Build keyword tags from entities + signals
    const tags = [
      ...entities.regulations,
      ...entities.amounts,
    ];

    return {
      sourceId,
      title: item.title.slice(0, 500),
      url: item.url.slice(0, 2000),
      contentHash: contentHash(item.title, item.url),
      summary: item.summary.slice(0, 2000) || null,
      author: item.author.slice(0, 200) || null,
      entities: entityNames,
      signals: signals as string[],
      tags,
      publishedAt: item.publishedAt,
    };
  });

  // Step 3: Batch insert with deduplication
  // createMany with skipDuplicates handles the @@unique([sourceId, contentHash]) constraint
  const result = await prisma.feedItem.createMany({
    data: feedItemRecords,
    skipDuplicates: true,
  });

  return { newItems: result.count };
}
