import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CacheMetricsService } from './cache-metrics.service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache key namespace
}

@Injectable()
export class CacheManager {
  private readonly logger = new Logger(CacheManager.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly metricsService: CacheMetricsService,
  ) {}

  /**
   * Generate a cache key with optional namespace
   */
  generateKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | undefined> {
    const fullKey = this.generateKey(key, options?.namespace);
    
    try {
      const value = await this.cacheManager.get<T>(fullKey);
      
      if (value !== undefined && value !== null) {
        this.metricsService.recordHit(fullKey);
        this.logger.debug(`Cache HIT: ${fullKey}`);
      } else {
        this.metricsService.recordMiss(fullKey);
        this.logger.debug(`Cache MISS: ${fullKey}`);
      }
      
      return value;
    } catch (error) {
      this.logger.error(`Cache get error for key ${fullKey}:`, error);
      this.metricsService.recordMiss(fullKey);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.generateKey(key, options?.namespace);
    const ttl = options?.ttl ? options.ttl * 1000 : undefined; // Convert to milliseconds
    
    try {
      await this.cacheManager.set(fullKey, value, ttl);
      this.logger.debug(`Cache SET: ${fullKey} (TTL: ${options?.ttl || 'default'}s)`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${fullKey}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string, options?: CacheOptions): Promise<void> {
    const fullKey = this.generateKey(key, options?.namespace);
    
    try {
      await this.cacheManager.del(fullKey);
      this.logger.debug(`Cache DEL: ${fullKey}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${fullKey}:`, error);
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const store = this.cacheManager.store;
      
      // For memory cache, we need to get all keys and filter
      if (typeof store.keys === 'function') {
        const keys = await store.keys();
        const matchingKeys = keys.filter((key: string) => 
          this.matchPattern(key, pattern)
        );
        
        await Promise.all(
          matchingKeys.map((key: string) => this.cacheManager.del(key))
        );
        
        this.logger.debug(`Cache DEL pattern: ${pattern} (${matchingKeys.length} keys)`);
      }
    } catch (error) {
      this.logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async reset(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Cache reset error:', error);
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    
    return value;
  }

  /**
   * Simple pattern matching for cache keys
   */
  private matchPattern(key: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexPattern}$`).test(key);
  }

  /**
   * Warm cache with data
   */
  async warm<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<void> {
    try {
      const value = await factory();
      await this.set(key, value, options);
      this.logger.log(`Cache warmed: ${key}`);
    } catch (error) {
      this.logger.error(`Cache warming error for ${key}:`, error);
    }
  }
}
