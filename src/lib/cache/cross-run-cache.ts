/**
 * Two-Tier Cross-Run Cache
 *
 * L1: In-memory (per-process, instant, cleared on deploy)
 * L2: Upstash Redis (persistent across runs, shared across instances)
 *
 * Implements the ToolCache interface from data-sources/types.ts.
 * Drop-in replacement for ResultCache when Redis is configured.
 */

import type { ToolCache, ToolResult, CacheEntry } from "@/lib/data-sources/types";
import { getRedisClient } from "./redis";

/** TTL presets by tool category (seconds) */
export const CACHE_TTL = {
  government: 24 * 60 * 60,      // 24h — government data changes slowly
  rss: 1 * 60 * 60,              // 1h — RSS feeds update frequently
  realtime: 15 * 60,             // 15m — real-time API data
  dataset: 6 * 60 * 60,         // 6h — dataset query results
  default: 4 * 60 * 60,         // 4h — conservative default
} as const;

export class CrossRunCache implements ToolCache {
  private l1 = new Map<string, CacheEntry>();
  private l1Hits = 0;
  private l2Hits = 0;
  private misses = 0;
  private ttlSeconds: number;

  constructor(ttlSeconds: number = CACHE_TTL.default) {
    this.ttlSeconds = ttlSeconds;
  }

  async getOrCompute(
    toolName: string,
    input: Record<string, unknown>,
    compute: () => Promise<ToolResult>,
  ): Promise<ToolResult> {
    const key = this.cacheKey(toolName, input);

    // L1: Check in-memory cache
    const l1Entry = this.l1.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      this.l1Hits++;
      return l1Entry.result;
    }

    // L2: Check Redis cache
    try {
      const redis = await getRedisClient();
      if (redis) {
        const l2Entry = await redis.get<CacheEntry>(key);
        if (l2Entry && !this.isExpired(l2Entry)) {
          this.l2Hits++;
          // Promote to L1
          this.l1.set(key, l2Entry);
          return l2Entry.result;
        }
      }
    } catch {
      // Redis failure is non-fatal — fall through to compute
    }

    // Cache miss — compute
    this.misses++;
    const result = await compute();
    const entry: CacheEntry = { result, createdAt: Date.now() };

    // Write to L1
    this.l1.set(key, entry);

    // Write to L2 (non-blocking)
    void this.writeToL2(key, entry);

    return result;
  }

  private async writeToL2(key: string, entry: CacheEntry): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.set(key, entry, { ex: this.ttlSeconds });
      }
    } catch {
      // Non-fatal — L1 still works
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    const ageMs = Date.now() - entry.createdAt;
    return ageMs > this.ttlSeconds * 1000;
  }

  private cacheKey(toolName: string, input: Record<string, unknown>): string {
    return `prism:tool:${toolName}::${JSON.stringify(input, Object.keys(input).sort())}`;
  }

  /** Clear L1 cache. Redis entries expire via TTL. */
  clear(): void {
    this.l1.clear();
    this.l1Hits = 0;
    this.l2Hits = 0;
    this.misses = 0;
  }

  /** Cache stats for observability */
  stats(): { l1Hits: number; l2Hits: number; misses: number; l1Entries: number } {
    return {
      l1Hits: this.l1Hits,
      l2Hits: this.l2Hits,
      misses: this.misses,
      l1Entries: this.l1.size,
    };
  }
}
