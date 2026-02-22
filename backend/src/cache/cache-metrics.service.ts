import { Injectable, Logger } from '@nestjs/common';

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  keyMetrics: Map<string, { hits: number; misses: number }>;
}

@Injectable()
export class CacheMetricsService {
  private readonly logger = new Logger(CacheMetricsService.name);
  private hits = 0;
  private misses = 0;
  private keyMetrics = new Map<string, { hits: number; misses: number }>();

  /**
   * Record a cache hit
   */
  recordHit(key: string): void {
    this.hits++;
    this.updateKeyMetrics(key, 'hit');
  }

  /**
   * Record a cache miss
   */
  recordMiss(key: string): void {
    this.misses++;
    this.updateKeyMetrics(key, 'miss');
  }

  /**
   * Update metrics for a specific key
   */
  private updateKeyMetrics(key: string, type: 'hit' | 'miss'): void {
    const metrics = this.keyMetrics.get(key) || { hits: 0, misses: 0 };
    
    if (type === 'hit') {
      metrics.hits++;
    } else {
      metrics.misses++;
    }
    
    this.keyMetrics.set(key, metrics);
  }

  /**
   * Get current metrics
   */
  getMetrics(): CacheMetrics {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: parseFloat(hitRate.toFixed(2)),
      totalRequests,
      keyMetrics: this.keyMetrics,
    };
  }

  /**
   * Get metrics for a specific key
   */
  getKeyMetrics(key: string): { hits: number; misses: number; hitRate: number } | null {
    const metrics = this.keyMetrics.get(key);
    
    if (!metrics) {
      return null;
    }

    const total = metrics.hits + metrics.misses;
    const hitRate = total > 0 ? (metrics.hits / total) * 100 : 0;

    return {
      ...metrics,
      hitRate: parseFloat(hitRate.toFixed(2)),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.keyMetrics.clear();
    this.logger.log('Cache metrics reset');
  }

  /**
   * Log current metrics
   */
  logMetrics(): void {
    const metrics = this.getMetrics();
    this.logger.log(
      `Cache Metrics - Hits: ${metrics.hits}, Misses: ${metrics.misses}, ` +
      `Hit Rate: ${metrics.hitRate}%, Total: ${metrics.totalRequests}`
    );
  }
}
