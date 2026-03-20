/**
 * Per-Pipeline-Run Result Cache
 *
 * Caches tool results keyed by (toolName, inputHash). Uses promise coalescing
 * to prevent redundant API calls when parallel agents request the same data.
 *
 * Scoped to a single pipeline run — call clear() between runs.
 *
 * Phase 8: Optionally delegates to CrossRunCache for L1 (in-memory) + L2 (Redis)
 * persistence. When a CrossRunCache is set, getOrCompute checks the persistent
 * layer before computing, giving cross-run cache hits. The inflight coalescing
 * layer still applies on top to prevent duplicate concurrent calls.
 */

import type { ToolResult, CacheEntry } from "./types";
import type { CrossRunCache } from "@/lib/cache/cross-run-cache";

export class ResultCache {
  private store = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<ToolResult>>();
  private hits = 0;
  private misses = 0;
  private crossRunCache: CrossRunCache | null = null;

  /**
   * Create a ResultCache with an optional CrossRunCache for L2 persistence.
   * The default constructor remains pure in-memory for backward compatibility.
   */
  constructor(crossRunCache?: CrossRunCache) {
    this.crossRunCache = crossRunCache ?? null;
  }

  /**
   * Factory: create a ResultCache backed by a CrossRunCache instance.
   * Use this when you want cross-run persistence (L1 in-memory + L2 Redis).
   */
  static withCrossRunCache(crossRunCache: CrossRunCache): ResultCache {
    return new ResultCache(crossRunCache);
  }

  /**
   * Get a cached result or compute it. If another caller is already computing
   * the same (toolName, input), this awaits the same promise instead of making
   * a duplicate API call.
   *
   * When a CrossRunCache is configured, delegates to it for L1+L2 lookup
   * before falling back to compute. Inflight coalescing still applies.
   */
  async getOrCompute(
    toolName: string,
    input: Record<string, unknown>,
    compute: () => Promise<ToolResult>,
  ): Promise<ToolResult> {
    const key = this.cacheKey(toolName, input);

    // 1. Check completed in-memory cache (per-run L0)
    const cached = this.store.get(key);
    if (cached) {
      this.hits++;
      return cached.result;
    }

    // 2. Check inflight — another caller already computing this
    const existing = this.inflight.get(key);
    if (existing) {
      this.hits++;
      return existing;
    }

    // 3. Delegate to CrossRunCache if configured (L1 in-memory + L2 Redis)
    if (this.crossRunCache) {
      const crossRunCompute = async (): Promise<ToolResult> => {
        const result = await this.crossRunCache!.getOrCompute(toolName, input, compute);
        // Promote to per-run store for subsequent same-run lookups
        this.store.set(key, { result, createdAt: Date.now() });
        return result;
      };

      this.misses++;
      const promise = crossRunCompute()
        .then((result) => {
          this.inflight.delete(key);
          return result;
        })
        .catch((err) => {
          this.inflight.delete(key);
          throw err;
        });

      this.inflight.set(key, promise);
      return promise;
    }

    // 4. Pure in-memory cache miss — compute and share the promise
    this.misses++;
    const promise = compute()
      .then((result) => {
        this.store.set(key, { result, createdAt: Date.now() });
        this.inflight.delete(key);
        return result;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Clear all entries (call between pipeline runs) */
  clear(): void {
    this.store.clear();
    this.inflight.clear();
    this.hits = 0;
    this.misses = 0;
    this.crossRunCache?.clear();
  }

  /** Cache stats for observability — merges per-run + cross-run stats */
  stats(): {
    hits: number;
    misses: number;
    entries: number;
    crossRun?: { l1Hits: number; l2Hits: number; misses: number; l1Entries: number };
  } {
    const base = { hits: this.hits, misses: this.misses, entries: this.store.size };
    if (this.crossRunCache) {
      return { ...base, crossRun: this.crossRunCache.stats() };
    }
    return base;
  }

  private cacheKey(toolName: string, input: Record<string, unknown>): string {
    return `${toolName}::${JSON.stringify(input, Object.keys(input).sort())}`;
  }
}
