import { Controller, Get, Delete, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CacheManager } from './cache-manager.service';
import { CacheMetricsService } from './cache-metrics.service';
import { CacheInvalidator } from './cache-invalidator.service';

@Controller('cache')
export class CacheController {
  constructor(
    private readonly cacheManager: CacheManager,
    private readonly metricsService: CacheMetricsService,
    private readonly cacheInvalidator: CacheInvalidator,
  ) {}

  /**
   * Get cache metrics
   */
  @Get('metrics')
  getMetrics() {
    return this.metricsService.getMetrics();
  }

  /**
   * Get metrics for a specific key
   */
  @Get('metrics/:key')
  getKeyMetrics(@Param('key') key: string) {
    return this.metricsService.getKeyMetrics(key);
  }

  /**
   * Clear all cache
   */
  @Delete('clear')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCache() {
    await this.cacheManager.reset();
  }

  /**
   * Invalidate cache by pattern
   */
  @Delete('pattern/:pattern')
  @HttpCode(HttpStatus.NO_CONTENT)
  async invalidatePattern(@Param('pattern') pattern: string) {
    await this.cacheInvalidator.invalidatePattern(pattern);
  }

  /**
   * Invalidate cache by key
   */
  @Delete('key/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async invalidateKey(@Param('key') key: string) {
    await this.cacheInvalidator.invalidateKey(key);
  }

  /**
   * Reset cache metrics
   */
  @Delete('metrics')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetMetrics() {
    this.metricsService.reset();
  }
}
