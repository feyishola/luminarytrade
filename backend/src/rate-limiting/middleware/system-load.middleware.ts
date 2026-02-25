import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AdaptiveRateLimiterService } from '../services/adaptive-rate-limiter.service';
import { RateLimitMetricsService } from '../services/rate-limit-metrics.service';
import { SystemLoadMetrics } from '../interfaces/rate-limiter.interface';

@Injectable()
export class SystemLoadMiddleware implements NestMiddleware {
  private requestCount = 0;
  private lastReset = Date.now();

  constructor(
    private adaptiveLimiter: AdaptiveRateLimiterService,
    private metrics: RateLimitMetricsService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    this.requestCount++;

    // Record system load every 10 seconds
    const now = Date.now();
    if (now - this.lastReset >= 10000) {
      await this.recordSystemLoad();
      this.requestCount = 0;
      this.lastReset = now;
    }

    next();
  }

  private async recordSystemLoad(): Promise<void> {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();

    // Calculate CPU usage percentage (approximate)
    const totalCpuTime = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    const cpuPercent = Math.min(100, (totalCpuTime / 10) * 100); // Over 10 second window

    // Calculate memory usage percentage
    const totalMemory = require('os').totalmem();
    const memoryPercent = (memoryUsage.heapUsed / totalMemory) * 100;

    const metrics: SystemLoadMetrics = {
      cpuUsage: cpuPercent,
      memoryUsage: memoryPercent,
      requestRate: this.requestCount / 10, // Requests per second
      activeConnections: 0, // Would need additional tracking
      timestamp: new Date(),
    };

    await this.adaptiveLimiter.recordSystemLoad(metrics);
    await this.metrics.recordSystemLoad(metrics);
  }
}
