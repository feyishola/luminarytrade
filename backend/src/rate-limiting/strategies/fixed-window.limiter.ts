import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  IRateLimiter,
  RateLimitResult,
  RateLimiterOptions,
} from '../interfaces/rate-limiter.interface';

interface WindowData {
  count: number;
  windowStart: number;
}

@Injectable()
export class FixedWindowLimiter implements IRateLimiter {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async check(
    key: string,
    options: Partial<RateLimiterOptions> = {},
  ): Promise<RateLimitResult> {
    const windowMs = options.windowMs || 60000;
    const maxRequests = options.maxRequests || 100;
    const keyPrefix = options.keyPrefix || 'ratelimit:fixed';
    const fullKey = `${keyPrefix}:${key}`;

    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetTime = windowStart + windowMs;

    const current = await this.cache.get<WindowData>(fullKey);

    if (!current || current.windowStart !== windowStart) {
      const newData: WindowData = {
        count: 1,
        windowStart,
      };
      await this.cache.set(fullKey, newData, windowMs);

      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        resetTime,
      };
    }

    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetTime,
        retryAfter,
      };
    }

    current.count++;
    await this.cache.set(fullKey, current, windowMs);

    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - current.count,
      resetTime,
    };
  }

  async reset(key: string, options: Partial<RateLimiterOptions> = {}): Promise<void> {
    const keyPrefix = options.keyPrefix || 'ratelimit:fixed';
    const fullKey = `${keyPrefix}:${key}`;
    await this.cache.del(fullKey);
  }
}
