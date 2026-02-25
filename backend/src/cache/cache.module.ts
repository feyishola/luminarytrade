import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { CacheManager } from './cache-manager.service';
import { CacheInvalidator } from './cache-invalidator.service';
import { CacheMetricsService } from './cache-metrics.service';
import { CacheController } from './cache.controller';

@Global()
@Module({
  imports: [
    NestCacheModule.register({
      ttl: 300, // 5 minutes default TTL (in seconds)
      max: 1000, // Maximum number of items in cache
      isGlobal: true,
    }),
  ],
  controllers: [CacheController],
  providers: [CacheManager, CacheInvalidator, CacheMetricsService],
  exports: [CacheManager, CacheInvalidator, CacheMetricsService],
})
export class CacheModule {}
