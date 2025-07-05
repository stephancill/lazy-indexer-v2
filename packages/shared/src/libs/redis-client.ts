/**
 * Redis client with connection pooling and caching utilities
 *
 * This module provides an optimized Redis client with connection pooling,
 * automatic failover, and caching strategies for the Farcaster Indexer.
 */

import Redis from "ioredis";
import { config, isProduction, isDevelopment, isTest } from "../config.js";

/**
 * Redis connection pool configurations
 */
const REDIS_POOL_CONFIG = {
  PRODUCTION: {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxLoadingTimeout: 5000,
    lazyConnect: false,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    family: 4, // IPv4
    db: config.redis.db || 0,
  },

  DEVELOPMENT: {
    maxRetriesPerRequest: 2,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxLoadingTimeout: 3000,
    lazyConnect: false,
    keepAlive: 30000,
    connectTimeout: 5000,
    commandTimeout: 3000,
    family: 4,
    db: config.redis.db || 0,
  },

  TEST: {
    maxRetriesPerRequest: 1,
    retryDelayOnFailover: 50,
    enableReadyCheck: false,
    maxLoadingTimeout: 1000,
    lazyConnect: true,
    keepAlive: 10000,
    connectTimeout: 2000,
    commandTimeout: 1000,
    family: 4,
    db: config.redis.db || 1, // Use different DB for tests
  },
} as const;

/**
 * Get Redis configuration based on environment
 */
function getRedisConfig() {
  if (isProduction()) {
    return REDIS_POOL_CONFIG.PRODUCTION;
  } else if (isTest()) {
    return REDIS_POOL_CONFIG.TEST;
  } else {
    return REDIS_POOL_CONFIG.DEVELOPMENT;
  }
}

/**
 * Create optimized Redis client
 */
function createRedisClient(): Redis {
  const redisConfig = getRedisConfig();

  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    ...redisConfig,
  });

  // Connection event handlers
  client.on("connect", () => {
    console.log("Redis connected successfully");
  });

  client.on("ready", () => {
    console.log("🚀 Redis ready");
  });

  client.on("error", (error) => {
    console.error("❌ Redis error:", error);
  });

  client.on("close", () => {
    console.log("🔌 Redis connection closed");
  });

  client.on("reconnecting", (delay: number) => {
    console.log(`🔄 Redis reconnecting in ${delay}ms...`);
  });

  return client;
}

// Lazy-loaded Redis clients
let _redis: Redis | null = null;
let _redisSubscriber: Redis | null = null;

/**
 * Get Redis client (lazy-loaded)
 */
export function getRedisClient(): Redis {
  if (!_redis) {
    _redis = createRedisClient();
  }
  return _redis;
}

/**
 * Get Redis subscriber client (lazy-loaded)
 */
export function getRedisSubscriber(): Redis {
  if (!_redisSubscriber) {
    _redisSubscriber = createRedisClient();
  }
  return _redisSubscriber;
}

// Export redis for backward compatibility
export const redis = getRedisClient();
export const redisSubscriber = getRedisSubscriber();

/**
 * Cache key utilities
 */
export const CacheKeys = {
  // Target management
  TARGET_SET: "targets:set",
  CLIENT_SET: "clients:set",
  TARGET_SYNC_STATUS: (fid: number) => `target:${fid}:sync`,

  // User data caching
  USER_PROFILE: (fid: number) => `user:${fid}:profile`,
  USER_CASTS: (fid: number, page: number = 1) => `user:${fid}:casts:${page}`,
  USER_FOLLOWERS: (fid: number) => `user:${fid}:followers`,
  USER_FOLLOWING: (fid: number) => `user:${fid}:following`,

  // Feed caching
  USER_FEED: (fid: number, page: number = 1) => `feed:${fid}:${page}`,
  TRENDING_FEED: (hours: number = 24) => `trending:${hours}h`,

  // Event processing
  LAST_EVENT_ID: "sync:last_event_id",
  PROCESSING_LOCK: (jobType: string) => `lock:${jobType}`,

  // Rate limiting
  RATE_LIMIT: (identifier: string, window: string) =>
    `rate_limit:${identifier}:${window}`,

  // Statistics
  STATS_DAILY: (date: string) => `stats:daily:${date}`,
  STATS_HOURLY: (hour: string) => `stats:hourly:${hour}`,
} as const;

/**
 * Cache time-to-live values (in seconds)
 */
export const CacheTTL = {
  // Short-lived cache (1-5 minutes)
  VERY_SHORT: 60, // 1 minute
  SHORT: 300, // 5 minutes

  // Medium-lived cache (15-60 minutes)
  MEDIUM: 900, // 15 minutes
  LONG: 3600, // 1 hour

  // Long-lived cache (hours to days)
  VERY_LONG: 21600, // 6 hours
  DAILY: 86400, // 24 hours
  WEEKLY: 604800, // 7 days
} as const;

/**
 * Redis caching utilities
 */
export class RedisCache {
  constructor(private client: Redis = redis) {}

  /**
   * Get cached value with automatic JSON parsing
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) return null;

      try {
        return JSON.parse(value);
      } catch {
        // Return as string if not JSON
        return value as T;
      }
    } catch (error) {
      console.warn(`Cache get failed for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value with automatic JSON serialization
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);

      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }

      return true;
    } catch (error) {
      console.warn(`Cache set failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.warn(`Cache delete failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.warn(`Cache exists check failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration time for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.warn(`Cache expire failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mget(...keys);
      return values.map((value) => {
        if (value === null) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      console.warn(`Cache mget failed for keys ${keys.join(", ")}:`, error);
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset<T = any>(
    pairs: Array<[string, T]>,
    ttl?: number
  ): Promise<boolean> {
    try {
      const serializedPairs = pairs.flatMap(([key, value]) => [
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      ]);

      await this.client.mset(...serializedPairs);

      // Set TTL for all keys if specified
      if (ttl) {
        const pipeline = this.client.pipeline();
        for (const [key] of pairs) {
          pipeline.expire(key, ttl);
        }
        await pipeline.exec();
      }

      return true;
    } catch (error) {
      console.warn(`Cache mset failed:`, error);
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string, by: number = 1): Promise<number> {
    try {
      if (by === 1) {
        return await this.client.incr(key);
      } else {
        return await this.client.incrby(key, by);
      }
    } catch (error) {
      console.warn(`Cache incr failed for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = CacheTTL.MEDIUM
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetcher();

    // Cache the result
    await this.set(key, fresh, ttl);

    return fresh;
  }

  /**
   * Cache with lock to prevent thundering herd
   */
  async getOrSetWithLock<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = CacheTTL.MEDIUM,
    lockTtl: number = 30
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const lockKey = `${key}:lock`;

    // Try to acquire lock
    const lockAcquired = await this.client.set(
      lockKey,
      "1",
      "EX",
      lockTtl,
      "NX"
    );

    if (!lockAcquired) {
      // Wait a bit and try cache again
      await new Promise((resolve) => setTimeout(resolve, 100));
      const cachedAgain = await this.get<T>(key);
      if (cachedAgain !== null) {
        return cachedAgain;
      }

      // If still no cache, fetch without lock (accept potential duplicate work)
      return await fetcher();
    }

    try {
      // Fetch fresh data
      const fresh = await fetcher();

      // Cache the result
      await this.set(key, fresh, ttl);

      return fresh;
    } finally {
      // Release lock
      await this.del(lockKey);
    }
  }
}

/**
 * Target set management utilities
 */
export class TargetSetManager {
  constructor(private cache: RedisCache = new RedisCache()) {}

  /**
   * Add FID to target set
   */
  async addTarget(fid: number): Promise<boolean> {
    try {
      await redis.sadd(CacheKeys.TARGET_SET, fid.toString());
      return true;
    } catch (error) {
      console.warn(`Failed to add target ${fid}:`, error);
      return false;
    }
  }

  /**
   * Remove FID from target set
   */
  async removeTarget(fid: number): Promise<boolean> {
    try {
      await redis.srem(CacheKeys.TARGET_SET, fid.toString());
      return true;
    } catch (error) {
      console.warn(`Failed to remove target ${fid}:`, error);
      return false;
    }
  }

  /**
   * Check if FID is in target set
   */
  async isTarget(fid: number): Promise<boolean> {
    try {
      const result = await redis.sismember(
        CacheKeys.TARGET_SET,
        fid.toString()
      );
      return result === 1;
    } catch (error) {
      console.warn(`Failed to check target ${fid}:`, error);
      return false;
    }
  }

  /**
   * Get all target FIDs
   */
  async getAllTargets(): Promise<number[]> {
    try {
      const members = await redis.smembers(CacheKeys.TARGET_SET);
      return members.map(Number).filter((n) => !isNaN(n));
    } catch (error) {
      console.warn("Failed to get all targets:", error);
      return [];
    }
  }

  /**
   * Get target count
   */
  async getTargetCount(): Promise<number> {
    try {
      return await redis.scard(CacheKeys.TARGET_SET);
    } catch (error) {
      console.warn("Failed to get target count:", error);
      return 0;
    }
  }

  /**
   * Add multiple targets efficiently
   */
  async addTargets(fids: number[]): Promise<boolean> {
    if (fids.length === 0) return true;

    try {
      await redis.sadd(CacheKeys.TARGET_SET, ...fids.map(String));
      return true;
    } catch (error) {
      console.warn("Failed to add multiple targets:", error);
      return false;
    }
  }

  /**
   * Sync target set from database
   */
  async syncFromDatabase(targetFids: number[]): Promise<boolean> {
    try {
      // Clear existing set
      await redis.del(CacheKeys.TARGET_SET);

      // Add all targets
      if (targetFids.length > 0) {
        await this.addTargets(targetFids);
      }

      console.log(`✅ Synced ${targetFids.length} targets to Redis`);
      return true;
    } catch (error) {
      console.warn("Failed to sync targets from database:", error);
      return false;
    }
  }
}

/**
 * Rate limiting utilities
 */
export class RateLimiter {
  constructor(private cache: RedisCache = new RedisCache()) {}

  /**
   * Check if request is within rate limit
   */
  async isAllowed(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = CacheKeys.RATE_LIMIT(identifier, `${windowSeconds}s`);

    try {
      const current = await this.cache.incr(key);

      if (current === 1) {
        // First request in window, set expiration
        await this.cache.expire(key, windowSeconds);
      }

      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      const resetTime = Date.now() + windowSeconds * 1000;

      return { allowed, remaining, resetTime };
    } catch (error) {
      console.warn(`Rate limit check failed for ${identifier}:`, error);
      // Fail open - allow the request
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: Date.now() + windowSeconds * 1000,
      };
    }
  }

  /**
   * Reset rate limit for identifier
   */
  async reset(identifier: string, windowSeconds: number): Promise<boolean> {
    const key = CacheKeys.RATE_LIMIT(identifier, `${windowSeconds}s`);
    return await this.cache.del(key);
  }
}

/**
 * Create global instances
 */
export const redisCache = new RedisCache();
export const targetSetManager = new TargetSetManager();
export const rateLimiter = new RateLimiter();

/**
 * Redis health check
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch (error) {
    console.error("Redis health check failed:", error);
    return false;
  }
}

/**
 * Get Redis connection info
 */
export function getRedisInfo() {
  return {
    status: redis.status,
    host: config.redis.host,
    port: config.redis.port,
    db: config.redis.db,
  };
}

/**
 * Graceful Redis shutdown
 */
export async function closeRedisConnections(): Promise<void> {
  console.log("Closing Redis connections...");

  try {
    await redis.quit();
    await redisSubscriber.quit();
    console.log("✅ Redis connections closed successfully");
  } catch (error) {
    console.error("❌ Error closing Redis connections:", error);
    throw error;
  }
}

// Process cleanup handlers
process.on("SIGINT", async () => {
  console.log("Received SIGINT, closing Redis connections...");
  await closeRedisConnections();
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, closing Redis connections...");
  await closeRedisConnections();
});
