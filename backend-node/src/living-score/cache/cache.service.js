'use strict';
const { createLogger } = require('../common/logger');

const logger = createLogger('Cache');

/**
 * Read-through cache. Uses Redis when REDIS_URL is set and reachable, otherwise falls back to a
 * small in-process TTL map — so the API keeps working (just without a shared cache) if Redis is down.
 */
class CacheService {
  constructor(config) {
    this.config = config;
    this.memory = new Map();
    this.redisHealthy = false;
    this.redis = null;

    if (config.redisUrl && config.cacheTtlSeconds > 0) {
      const Redis = require('ioredis');
      this.redis = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
      });
      this.redis.on('ready', () => {
        this.redisHealthy = true;
        logger.log('Redis cache connected');
      });
      this.redis.on('error', (error) => {
        if (this.redisHealthy) logger.warn(`Redis error, using in-memory cache: ${error.message}`);
        this.redisHealthy = false;
      });
      this.redis.on('end', () => {
        this.redisHealthy = false;
      });
      this.redis.connect().catch((error) => {
        logger.warn(`Redis unavailable (${error.message}); using in-memory cache.`);
      });
    }
  }

  /** 'redis' | 'memory' | 'disabled' */
  get backend() {
    if (this.config.cacheTtlSeconds <= 0) return 'disabled';
    return this.redis && this.redisHealthy ? 'redis' : 'memory';
  }

  close() {
    this.redis?.disconnect();
  }

  /** Returns the cached value for `key`, or computes, stores and returns it. */
  async wrap(key, compute, ttlSeconds = this.config.cacheTtlSeconds) {
    if (ttlSeconds <= 0) return compute();
    const cached = await this.read(`hls:${key}`);
    if (cached !== undefined) return JSON.parse(cached);
    const value = await compute();
    await this.write(`hls:${key}`, JSON.stringify(value), ttlSeconds);
    return value;
  }

  async read(key) {
    if (this.redis && this.redisHealthy) {
      try {
        const hit = await this.redis.get(key);
        return hit === null ? undefined : hit;
      } catch {
        // fall through to the memory cache
      }
    }
    const entry = this.memory.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async write(key, value, ttlSeconds) {
    if (this.redis && this.redisHealthy) {
      try {
        await this.redis.set(key, value, 'EX', ttlSeconds);
        return;
      } catch {
        // fall through to the memory cache
      }
    }
    if (this.memory.size > 500) this.memory.clear();
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

module.exports = { CacheService };
