import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';
import {
  RateLimitMetadata,
  RateLimitStrategy,
  RateLimitResult,
} from '../interfaces/rate-limiter.interface';
import { FixedWindowLimiter } from '../strategies/fixed-window.limiter';
import { SlidingWindowLimiter } from '../strategies/sliding-window.limiter';
import { TokenBucketLimiter } from '../strategies/token-bucket.limiter';
import { AdaptiveRateLimiterService } from '../services/adaptive-rate-limiter.service';
import { IpFilterService } from '../services/ip-filter.service';
import { RateLimitMetricsService } from '../services/rate-limit-metrics.service';
import { getRateLimitConfig, applyTierMultiplier, EndpointType } from '../config/rate-limit.config';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private fixedWindowLimiter: FixedWindowLimiter,
    private slidingWindowLimiter: SlidingWindowLimiter,
    private tokenBucketLimiter: TokenBucketLimiter,
    private adaptiveLimiter: AdaptiveRateLimiterService,
    private ipFilter: IpFilterService,
    private metrics: RateLimitMetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Check for skip rate limit
    const skipRateLimit = this.reflector.get<boolean>('skip_rate_limit', context.getHandler());
    if (skipRateLimit) {
      return true;
    }

    const ip = this.getClientIp(request);
    const user = (request as any).user;
    const userId = user?.id;

    // Check whitelist
    if (this.ipFilter.isWhitelisted(ip)) {
      return true;
    }

    // Check blacklist
    if (this.ipFilter.isBlacklisted(ip)) {
      this.setRateLimitHeaders(response, {
        allowed: false,
        limit: 0,
        remaining: 0,
        resetTime: Date.now() + 86400000,
        retryAfter: 86400,
      });
      throw new HttpException('IP Blacklisted', HttpStatus.FORBIDDEN);
    }

    // Get rate limit metadata
    const metadata = this.reflector.get<RateLimitMetadata>(RATE_LIMIT_KEY, context.getHandler());
    const endpointType = this.reflector.get<EndpointType>('rate_limit_endpoint_type', context.getHandler());
    const tier = this.reflector.get<string>('rate_limit_tier', context.getHandler()) ||
                 user?.tier ||
                 'free';

    let result: RateLimitResult;

    if (metadata) {
      result = await this.checkWithMetadata(ip, userId, metadata);
    } else if (endpointType) {
      result = await this.checkWithEndpointType(ip, userId, endpointType, tier);
    } else {
      // Default rate limiting
      result = await this.checkWithEndpointType(ip, userId, EndpointType.API, tier);
    }

    // Set rate limit headers
    this.setRateLimitHeaders(response, result);

    // Record metrics
    const endpoint = `${request.method}:${request.route?.path || request.path}`;
    await this.metrics.recordHit(endpoint, ip, result.allowed, userId);

    if (!result.allowed) {
      // Record violation
      await this.ipFilter.recordViolation(ip);

      // Update reputation
      if (userId) {
        await this.adaptiveLimiter.updateReputation(userId, true, false);
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Update reputation for good request
    if (userId) {
      await this.adaptiveLimiter.updateReputation(userId, false, true);
    }

    return true;
  }

  private async checkWithMetadata(
    ip: string,
    userId: string | undefined,
    metadata: RateLimitMetadata,
  ): Promise<RateLimitResult> {
    const key = metadata.perUser && userId ? `user:${userId}` : `ip:${ip}`;

    const options = {
      windowMs: metadata.window,
      maxRequests: metadata.requests,
      keyPrefix: 'ratelimit:custom',
    };

    switch (metadata.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        return this.fixedWindowLimiter.check(key, options);
      case RateLimitStrategy.TOKEN_BUCKET:
        return this.tokenBucketLimiter.check(key, options);
      case RateLimitStrategy.SLIDING_WINDOW:
      default:
        return this.slidingWindowLimiter.check(key, options);
    }
  }

  private async checkWithEndpointType(
    ip: string,
    userId: string | undefined,
    endpointType: EndpointType,
    tier: string,
  ): Promise<RateLimitResult> {
    let config = getRateLimitConfig(endpointType, tier);
    config = applyTierMultiplier(config, tier);

    const key = userId ? `user:${userId}:${endpointType}` : `ip:${ip}:${endpointType}`;

    const options = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyPrefix: config.keyPrefix,
    };

    switch (config.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        return this.fixedWindowLimiter.check(key, options);
      case RateLimitStrategy.TOKEN_BUCKET:
        return this.tokenBucketLimiter.check(key, options);
      case RateLimitStrategy.SLIDING_WINDOW:
      default:
        return this.slidingWindowLimiter.check(key, options);
    }
  }

  private setRateLimitHeaders(response: Response, result: RateLimitResult): void {
    response.setHeader('X-RateLimit-Limit', result.limit.toString());
    response.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining).toString());
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

    if (!result.allowed && result.retryAfter) {
      response.setHeader('Retry-After', result.retryAfter.toString());
    }
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
