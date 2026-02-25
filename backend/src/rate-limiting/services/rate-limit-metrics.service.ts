import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  AbusePattern,
  SystemLoadMetrics,
} from '../interfaces/rate-limiter.interface';

interface RateLimitHit {
  endpoint: string;
  ip: string;
  userId?: string;
  timestamp: Date;
  allowed: boolean;
}

export interface EndpointMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  violations: number;
}

@Injectable()
export class RateLimitMetricsService {
  private recentHits: RateLimitHit[] = [];
  private readonly maxHitsInMemory = 1000;

  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async recordHit(
    endpoint: string,
    ip: string,
    allowed: boolean,
    userId?: string,
  ): Promise<void> {
    const hit: RateLimitHit = {
      endpoint,
      ip,
      userId,
      timestamp: new Date(),
      allowed,
    };

    this.recentHits.push(hit);

    if (this.recentHits.length > this.maxHitsInMemory) {
      this.recentHits.shift();
    }

    // Store in cache for persistence
    const key = `metrics:hits:${endpoint}:${Date.now()}`;
    await this.cache.set(key, hit, 3600000); // 1 hour

    // Update endpoint metrics
    await this.updateEndpointMetrics(endpoint, allowed);
  }

  private async updateEndpointMetrics(endpoint: string, allowed: boolean): Promise<void> {
    const key = `metrics:endpoint:${endpoint}`;
    const current = await this.cache.get<EndpointMetrics>(key) || {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      violations: 0,
    };

    current.totalRequests++;
    if (allowed) {
      current.allowedRequests++;
    } else {
      current.blockedRequests++;
      current.violations++;
    }

    await this.cache.set(key, current, 24 * 60 * 60 * 1000); // 24 hours
  }

  async getEndpointMetrics(endpoint: string): Promise<EndpointMetrics> {
    return this.cache.get<EndpointMetrics>(`metrics:endpoint:${endpoint}`) || {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      violations: 0,
    };
  }

  async getAllEndpointMetrics(): Promise<Record<string, EndpointMetrics>> {
    const keys = await this.cache.store.keys?.('metrics:endpoint:*') || [];
    const metrics: Record<string, EndpointMetrics> = {};

    for (const key of keys) {
      const endpoint = key.replace('metrics:endpoint:', '');
      metrics[endpoint] = await this.getEndpointMetrics(endpoint);
    }

    return metrics;
  }

  async detectAbusePatterns(): Promise<AbusePattern[]> {
    const patterns: AbusePattern[] = [];
    const ipViolations: Record<string, RateLimitHit[]> = {};

    // Group violations by IP
    for (const hit of this.recentHits) {
      if (!hit.allowed) {
        if (!ipViolations[hit.ip]) {
          ipViolations[hit.ip] = [];
        }
        ipViolations[hit.ip].push(hit);
      }
    }

    // Detect patterns
    for (const [ip, violations] of Object.entries(ipViolations)) {
      if (violations.length >= 5) {
        const sorted = violations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const pattern = this.analyzePattern(sorted);

        patterns.push({
          ip,
          violations: violations.length,
          firstViolation: sorted[0].timestamp,
          lastViolation: sorted[sorted.length - 1].timestamp,
          pattern,
        });
      }
    }

    return patterns;
  }

  private analyzePattern(violations: RateLimitHit[]): string {
    if (violations.length < 2) return 'single_violation';

    const intervals: number[] = [];
    for (let i = 1; i < violations.length; i++) {
      const interval = violations[i].timestamp.getTime() - violations[i - 1].timestamp.getTime();
      intervals.push(interval);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

    if (variance < 1000) {
      return 'automated_burst';
    } else if (avgInterval < 1000) {
      return 'rapid_fire';
    } else if (avgInterval > 30000) {
      return 'intermittent';
    }

    return 'distributed';
  }

  async recordSystemLoad(metrics: SystemLoadMetrics): Promise<void> {
    const key = `metrics:load:${Date.now()}`;
    await this.cache.set(key, metrics, 3600000); // 1 hour
  }

  async getSystemLoadHistory(minutes: number = 60): Promise<SystemLoadMetrics[]> {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const keys = await this.cache.store.keys?.('metrics:load:*') || [];
    const metrics: SystemLoadMetrics[] = [];

    for (const key of keys) {
      const timestamp = parseInt(key.replace('metrics:load:', ''), 10);
      if (timestamp > cutoff) {
        const metric = await this.cache.get<SystemLoadMetrics>(key);
        if (metric) {
          metrics.push(metric);
        }
      }
    }

    return metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getTopViolators(limit: number = 10): Promise<Array<{ ip: string; violations: number }>> {
    const violators: Record<string, number> = {};

    for (const hit of this.recentHits) {
      if (!hit.allowed) {
        violators[hit.ip] = (violators[hit.ip] || 0) + 1;
      }
    }

    return Object.entries(violators)
      .map(([ip, violations]) => ({ ip, violations }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, limit);
  }

  async shouldAlert(): Promise<{ shouldAlert: boolean; reason?: string }> {
    const patterns = await this.detectAbusePatterns();
    const automatedBursts = patterns.filter(p => p.pattern === 'automated_burst');

    if (automatedBursts.length > 3) {
      return {
        shouldAlert: true,
        reason: `Detected ${automatedBursts.length} automated burst patterns`,
      };
    }

    const totalViolations = this.recentHits.filter(h => !h.allowed).length;
    if (totalViolations > 100) {
      return {
        shouldAlert: true,
        reason: `High violation rate: ${totalViolations} in recent window`,
      };
    }

    return { shouldAlert: false };
  }
}
