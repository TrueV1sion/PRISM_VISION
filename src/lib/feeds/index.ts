/**
 * RSS Feed Ingestion System — Barrel Exports
 *
 * Phase 2: Continuous news ingestion from 28 healthcare RSS sources.
 * Feeds are parsed, deduplicated, entity-extracted, and signal-classified.
 */

export { FEED_REGISTRY, type FeedSourceConfig } from "./registry";
export { parseFeed, type ParsedFeedItem } from "./parser";
export { extractEntities, type ExtractedEntities } from "./entity-extractor";
export { classifySignals, type SignalType } from "./signal-classifier";
export { ingestAllFeeds, ingestFeed } from "./ingestor";
