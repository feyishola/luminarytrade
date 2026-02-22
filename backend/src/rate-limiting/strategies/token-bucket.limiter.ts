import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  IRateLimiter,
  RateLimitResult,
  RateLimiterOptions,
} from '../interfaces/rate-limiter.interface';

interface TokenBucketData {
  tokens: number;
  lastRefill: number;
}

export interface TokenBucketOptions extends RateLimiterOptions {
  burstSize?: number;
  refillRate?: number;
}

@Injectable()
export class TokenBucketLimiter implements IRateLimiter {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async check(
    key: string,
    options: Partial<TokenBucketOptions> = {},
  ): Promise<RateLimitResult> {
    const windowMs = options.windowMs || 60000;
    const maxRequests = options.maxRequests || 100;
    const burstSize = options.burstSize || maxRequests;
    const keyPrefix = options.keyPrefix || 'ratelimit:bucket';
    const fullKey = `${keyPrefix}:${key}`;

    const now = Date.now();
    const refillRate = options.refillRate || maxRequests / (windowMs / 1000);

    const current = await this.cache.get<TokenBucketData>(fullKey);

    let tokens: number;
    let lastRefill: number;

    if (!current) {
      tokens = burstSize;
      lastRefill = now;
    } else {
      lastRefill = current.lastRefill;
      const elapsedMs = now - lastRefill;
      const tokensToAdd = (elapsedMs / 1000) * refillRate;
      tokens = Math.min(burstSize, current.tokens + tokensToAdd);
    }

    if (tokens < 1) {
      const tokensNeeded = 1 - tokens;
      const msUntilRefill = (tokensNeeded / refillRate) * 1000;
      const retryAfter = Math.ceil(msUntilRefill / 1000);

      await this.cache.set(fullKey, { tokens, lastRefill }, windowMs);

      return {
        allowed: false,
        limit: burstSize,
        remaining: 0,
        resetTime: now + msUntilRefill,
        retryAfter,
      };
    }

    tokens -= 1;
    await this.cache.set(fullKey, { tokens, lastRefill: now }, windowMs);

    return {
      allowed: true,
      limit: burstSize,
      remaining: Math.floor(tokens),
      resetTime: now + windowMs,
    };
  }

  async reset(key: string, options: Partial<TokenBucketOptions> = {}): Promise<void> {
    const keyPrefix = options.keyPrefix || 'ratelimit:bucket';
    const fullKey = `${keyPrefix}:${key}`;
    await this.cache.del(fullKey);
  }
}
