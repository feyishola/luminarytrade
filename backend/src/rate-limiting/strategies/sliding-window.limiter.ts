import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  IRateLimiter,
  RateLimitResult,
  RateLimiterOptions,
} from '../interfaces/rate-limiter.interface';

interface SlidingWindowData {
  requests: number[];
}

@Injectable()
export class SlidingWindowLimiter implements IRateLimiter {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async check(
    key: string,
    options: Partial<RateLimiterOptions> = {},
  ): Promise<RateLimitResult> {
    const windowMs = options.windowMs || 60000;
    const maxRequests = options.maxRequests || 100;
    const keyPrefix = options.keyPrefix || 'ratelimit:sliding';
    const fullKey = `${keyPrefix}:${key}`;

    const now = Date.now();
    const windowStart = now - windowMs;
    const resetTime = now + windowMs;

    const current = await this.cache.get<SlidingWindowData>(fullKey);
    let requests: number[] = current?.requests || [];

    requests = requests.filter(timestamp => timestamp > windowStart);

    if (requests.length >= maxRequests) {
      const oldestRequest = requests[0];
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

      await this.cache.set(fullKey, { requests }, windowMs);

      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetTime: oldestRequest + windowMs,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    requests.push(now);
    await this.cache.set(fullKey, { requests }, windowMs);

    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - requests.length,
      resetTime,
    };
  }

  async reset(key: string, options: Partial<RateLimiterOptions> = {}): Promise<void> {
    const keyPrefix = options.keyPrefix || 'ratelimit:sliding';
    const fullKey = `${keyPrefix}:${key}`;
    await this.cache.del(fullKey);
  }
}
