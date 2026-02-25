import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IpFilterService } from './services/ip-filter.service';
import { RateLimitMetricsService, EndpointMetrics } from './services/rate-limit-metrics.service';
import { AdaptiveRateLimiterService } from './services/adaptive-rate-limiter.service';
import { SkipRateLimit } from './decorators/rate-limit.decorator';
import { AbusePattern, SystemLoadMetrics } from './interfaces/rate-limiter.interface';

@Controller('admin/rate-limiting')
export class RateLimitingController {
  constructor(
    private ipFilter: IpFilterService,
    private metrics: RateLimitMetricsService,
    private adaptiveLimiter: AdaptiveRateLimiterService,
  ) {}

  @Get('whitelist')
  @SkipRateLimit()
  getWhitelist() {
    return {
      ips: this.ipFilter.getWhitelist(),
    };
  }

  @Post('whitelist')
  @SkipRateLimit()
  @HttpCode(HttpStatus.CREATED)
  async addToWhitelist(@Body('ip') ip: string) {
    await this.ipFilter.addToWhitelist(ip);
    return { message: 'IP added to whitelist', ip };
  }

  @Delete('whitelist/:ip')
  @SkipRateLimit()
  async removeFromWhitelist(@Param('ip') ip: string) {
    await this.ipFilter.removeFromWhitelist(ip);
    return { message: 'IP removed from whitelist', ip };
  }

  @Get('blacklist')
  @SkipRateLimit()
  getBlacklist() {
    return {
      ips: this.ipFilter.getBlacklist(),
    };
  }

  @Post('blacklist')
  @SkipRateLimit()
  @HttpCode(HttpStatus.CREATED)
  async addToBlacklist(@Body('ip') ip: string, @Body('reason') reason?: string) {
    await this.ipFilter.addToBlacklist(ip, reason);
    return { message: 'IP added to blacklist', ip, reason };
  }

  @Delete('blacklist/:ip')
  @SkipRateLimit()
  async removeFromBlacklist(@Param('ip') ip: string) {
    await this.ipFilter.removeFromBlacklist(ip);
    return { message: 'IP removed from blacklist', ip };
  }

  @Get('metrics')
  @SkipRateLimit()
  async getMetrics(): Promise<{
    endpoints: Record<string, EndpointMetrics>;
    topViolators: Array<{ ip: string; violations: number }>;
    abusePatterns: AbusePattern[];
  }> {
    const metrics = await this.metrics.getAllEndpointMetrics();
    const topViolators = await this.metrics.getTopViolators(10);
    const abusePatterns = await this.metrics.detectAbusePatterns();

    return {
      endpoints: metrics,
      topViolators,
      abusePatterns,
    };
  }

  @Get('metrics/load')
  @SkipRateLimit()
  async getLoadMetrics(@Body('minutes') minutes: number = 60): Promise<{
    history: SystemLoadMetrics[];
    currentMultiplier: number;
  }> {
    const history = await this.metrics.getSystemLoadHistory(minutes);
    return {
      history,
      currentMultiplier: await this.adaptiveLimiter.getCurrentMultiplier(),
    };
  }

  @Get('reputation/:userId')
  @SkipRateLimit()
  async getReputation(@Param('userId') userId: string) {
    const reputation = await this.adaptiveLimiter.getReputation(userId);
    return reputation || { message: 'No reputation data found' };
  }
}
