import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-process cache for specification execution results.
 * Replace with Redis adapter for multi-instance deployments.
 */
@Injectable()
export class SpecificationCache {
  private readonly logger = new Logger(SpecificationCache.name);
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL_MS = 30_000; // 30s default

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.DEFAULT_TTL_MS;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
    this.logger.debug(`Cached spec result: ${key} (TTL=${ttl}ms)`);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    this.logger.debug(`Invalidated ${count} cached entries with prefix: ${prefix}`);
    return count;
  }

  async flush(): Promise<void> {
    const size = this.store.size;
    this.store.clear();
    this.logger.debug(`Flushed ${size} cached entries`);
  }

  /** Remove all expired entries */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}
