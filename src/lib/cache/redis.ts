/**
 * Upstash Redis Client Wrapper
 *
 * Provides a lazy-initialized Upstash Redis client for the L2 cache layer.
 * Falls back gracefully when Redis is not configured (local development).
 *
 * NOTE: @upstash/redis must be installed before using this module.
 * Run: npm install @upstash/redis
 */

export interface RedisClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

let redisInstance: RedisClient | null = null;

/**
 * Get or create the Upstash Redis client singleton.
 * Returns null if Redis is not configured (UPSTASH_REDIS_REST_URL not set).
 */
export async function getRedisClient(): Promise<RedisClient | null> {
  if (redisInstance) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("[cache/redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — Redis L2 cache disabled");
    return null;
  }

  try {
    // Lazy import to avoid build failures when @upstash/redis isn't installed yet
    const { Redis } = await import("@upstash/redis");
    const client = new Redis({ url, token });

    redisInstance = {
      async get<T>(key: string): Promise<T | null> {
        return client.get<T>(key);
      },
      async set(key: string, value: unknown, options?: { ex?: number }): Promise<void> {
        if (options?.ex) {
          await client.set(key, value, { ex: options.ex });
        } else {
          await client.set(key, value);
        }
      },
      async del(key: string): Promise<void> {
        await client.del(key);
      },
      async exists(key: string): Promise<boolean> {
        const count = await client.exists(key);
        return count > 0;
      },
    };

    return redisInstance;
  } catch (error) {
    console.error("[cache/redis] Failed to initialize Upstash Redis:", error);
    return null;
  }
}

/** Reset the singleton (for testing). */
export function resetRedisClient(): void {
  redisInstance = null;
}
