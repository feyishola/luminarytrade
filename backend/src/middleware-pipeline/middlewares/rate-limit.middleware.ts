import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IMiddleware } from '../interfaces/middleware.interface';
import { AdaptiveRateLimiterService } from '../../rate-limiting/services/adaptive-rate-limiter.service';
import { RateLimitMetricsService } from '../../rate-limiting/services/rate-limit-metrics.service';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  block?: boolean;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware, IMiddleware {
  name = 'RateLimitMiddleware';
  private options: RateLimitOptions = {
    windowMs: 60000,
    maxRequests: 100,
    keyPrefix: 'ratelimit:pipeline',
    block: false,
  };

  constructor(
    private adaptiveLimiter: AdaptiveRateLimiterService,
    private metrics: RateLimitMetricsService,
  ) {}

  configure(config: any) {
    this.options = { ...this.options, ...(config as Partial<RateLimitOptions>) };
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;
    const key = userId ? `user:${userId}:pipeline` : `ip:${ip}:pipeline`;
    const result = await this.adaptiveLimiter.check(key, {
      windowMs: this.options.windowMs,
      maxRequests: this.options.maxRequests,
      keyPrefix: this.options.keyPrefix,
    });

    res.setHeader('X-RateLimit-Limit', String(this.options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(result.resetTime));
    if (!result.allowed && this.options.block) {
      await this.metrics.recordHit(`${req.method}:${req.path}`, ip, false, userId);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.metrics.recordHit(`${req.method}:${req.path}`, ip, true, userId);
    next();
  }
}
