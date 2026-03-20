/**
 * Cross-Run Cache Integration Tests — Phase 8 Verification
 *
 * Tests L1-only fallback, TTL resolution, stats merging,
 * and clear propagation between ResultCache and CrossRunCache.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResultCache } from "../cache";
import { CrossRunCache, CACHE_TTL } from "@/lib/cache/cross-run-cache";
import { TOOL_TTL_MAP } from "../registry";
import type { ToolResult } from "../types";

// ─── Mock Redis ─────────────────────────────────────────────

vi.mock("@/lib/cache/redis", () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  resetRedisClient: vi.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────

function makeResult(content: string): ToolResult {
  return {
    content,
    citations: [],
    vintage: { queriedAt: new Date().toISOString(), source: "test" },
    confidence: "HIGH",
    truncated: false,
  };
}

// ─── ResultCache — Pure In-Memory (L0 only) ─────────────────

describe("ResultCache — pure in-memory", () => {
  let cache: ResultCache;

  beforeEach(() => {
    cache = new ResultCache();
  });

  it("caches results by tool name + input", async () => {
    let calls = 0;
    const compute = async () => {
      calls++;
      return makeResult("hello");
    };

    const r1 = await cache.getOrCompute("tool_a", { q: "test" }, compute);
    const r2 = await cache.getOrCompute("tool_a", { q: "test" }, compute);

    expect(r1.content).toBe("hello");
    expect(r2.content).toBe("hello");
    expect(calls).toBe(1); // Only computed once
    expect(cache.stats().hits).toBe(1);
    expect(cache.stats().misses).toBe(1);
  });

  it("different inputs are cached separately", async () => {
    let calls = 0;
    const compute = async () => {
      calls++;
      return makeResult(`result-${calls}`);
    };

    await cache.getOrCompute("tool_a", { q: "alpha" }, compute);
    await cache.getOrCompute("tool_a", { q: "beta" }, compute);

    expect(calls).toBe(2);
    expect(cache.stats().misses).toBe(2);
  });

  it("clear resets all state", async () => {
    await cache.getOrCompute("tool_a", { q: "test" }, () =>
      Promise.resolve(makeResult("data")),
    );
    expect(cache.stats().entries).toBe(1);

    cache.clear();
    expect(cache.stats().entries).toBe(0);
    expect(cache.stats().hits).toBe(0);
    expect(cache.stats().misses).toBe(0);
  });

  it("stats do not include crossRun when no CrossRunCache", () => {
    const stats = cache.stats();
    expect(stats.crossRun).toBeUndefined();
  });
});

// ─── ResultCache — With CrossRunCache (L1 + L2) ─────────────

describe("ResultCache — with CrossRunCache", () => {
  let cache: ResultCache;
  let crossRunCache: CrossRunCache;

  beforeEach(() => {
    crossRunCache = new CrossRunCache(CACHE_TTL.default);
    cache = ResultCache.withCrossRunCache(crossRunCache);
  });

  it("delegates to CrossRunCache on miss", async () => {
    let computeCalls = 0;
    const compute = async () => {
      computeCalls++;
      return makeResult("cross-run-result");
    };

    const r1 = await cache.getOrCompute("tool_b", { q: "test" }, compute);
    expect(r1.content).toBe("cross-run-result");
    expect(computeCalls).toBe(1);
  });

  it("returns cached result from CrossRunCache on second call", async () => {
    let computeCalls = 0;
    const compute = async () => {
      computeCalls++;
      return makeResult("cached");
    };

    await cache.getOrCompute("tool_c", { q: "x" }, compute);

    // Create a new ResultCache sharing the same CrossRunCache
    // Simulates a new pipeline run with cross-run cache persistence
    const cache2 = ResultCache.withCrossRunCache(crossRunCache);
    const r2 = await cache2.getOrCompute("tool_c", { q: "x" }, compute);

    expect(r2.content).toBe("cached");
    expect(computeCalls).toBe(1); // Only computed once across both caches
  });

  it("stats include crossRun section", async () => {
    await cache.getOrCompute("tool_d", { q: "test" }, () =>
      Promise.resolve(makeResult("data")),
    );

    const stats = cache.stats();
    expect(stats.crossRun).toBeDefined();
    expect(stats.crossRun!.misses).toBeGreaterThanOrEqual(1);
  });

  it("clear propagates to CrossRunCache", async () => {
    await cache.getOrCompute("tool_e", { q: "test" }, () =>
      Promise.resolve(makeResult("data")),
    );

    cache.clear();
    expect(cache.stats().entries).toBe(0);
    expect(crossRunCache.stats().l1Entries).toBe(0);
  });

  it("factory method creates correctly configured cache", () => {
    const factoryCache = ResultCache.withCrossRunCache(crossRunCache);
    const stats = factoryCache.stats();
    expect(stats.crossRun).toBeDefined();
  });
});

// ─── CrossRunCache — L1 only (no Redis) ─────────────────────

describe("CrossRunCache — L1 fallback", () => {
  let cache: CrossRunCache;

  beforeEach(() => {
    cache = new CrossRunCache(3600); // 1h TTL
  });

  it("caches in L1 when Redis is unavailable", async () => {
    let calls = 0;
    const compute = async () => {
      calls++;
      return makeResult("l1-only");
    };

    const r1 = await cache.getOrCompute("tool_f", { q: "a" }, compute);
    const r2 = await cache.getOrCompute("tool_f", { q: "a" }, compute);

    expect(r1.content).toBe("l1-only");
    expect(r2.content).toBe("l1-only");
    expect(calls).toBe(1);
    expect(cache.stats().l1Hits).toBe(1);
    expect(cache.stats().misses).toBe(1);
  });

  it("clear resets L1 and stats", () => {
    cache.clear();
    const stats = cache.stats();
    expect(stats.l1Hits).toBe(0);
    expect(stats.l2Hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.l1Entries).toBe(0);
  });
});

// ─── CACHE_TTL Constants ────────────────────────────────────

describe("CACHE_TTL", () => {
  it("has expected categories", () => {
    expect(CACHE_TTL.government).toBe(86400);
    expect(CACHE_TTL.rss).toBe(3600);
    expect(CACHE_TTL.realtime).toBe(900);
    expect(CACHE_TTL.dataset).toBe(21600);
    expect(CACHE_TTL.default).toBe(14400);
  });
});

// ─── TTL Resolution ─────────────────────────────────────────

describe("TOOL_TTL_MAP", () => {
  it("maps government tools to government TTL", () => {
    expect(TOOL_TTL_MAP["search_congress"]).toBe("government");
    expect(TOOL_TTL_MAP["search_federal_register"]).toBe("government");
    expect(TOOL_TTL_MAP["search_hospital_quality"]).toBe("government");
    expect(TOOL_TTL_MAP["search_sbir"]).toBe("government");
  });

  it("maps feed tools to rss TTL", () => {
    expect(TOOL_TTL_MAP["search_feed_items"]).toBe("rss");
    expect(TOOL_TTL_MAP["research_news_intelligence"]).toBe("rss");
  });

  it("maps dataset tools to dataset TTL", () => {
    expect(TOOL_TTL_MAP["search_dataset_deltas"]).toBe("dataset");
    expect(TOOL_TTL_MAP["research_dataset_trends"]).toBe("dataset");
  });

  it("maps realtime tools to realtime TTL", () => {
    expect(TOOL_TTL_MAP["search_adverse_events"]).toBe("realtime");
    expect(TOOL_TTL_MAP["search_sec_filings"]).toBe("realtime");
    expect(TOOL_TTL_MAP["search_lobbying"]).toBe("realtime");
  });
});
