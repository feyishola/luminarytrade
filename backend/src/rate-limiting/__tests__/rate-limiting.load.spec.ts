import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import * as request from 'supertest';
import { RateLimitingModule } from '../rate-limiting.module';
import { RateLimit, RateLimitStrategy } from '../index';

@Controller('load-test')
class LoadTestController {
  @Get('fixed')
  @RateLimit(1000, 60000, RateLimitStrategy.FIXED_WINDOW)
  fixedWindow() {
    return { message: 'success' };
  }

  @Get('sliding')
  @RateLimit(1000, 60000, RateLimitStrategy.SLIDING_WINDOW)
  slidingWindow() {
    return { message: 'success' };
  }

  @Get('token')
  @RateLimit(1000, 60000, RateLimitStrategy.TOKEN_BUCKET)
  tokenBucket() {
    return { message: 'success' };
  }
}

const runNetworkTests = process.env.ALLOW_NETWORK_TESTS === 'true';
const describeIf = runNetworkTests ? describe : describe.skip;

describeIf('RateLimiting Load Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RateLimitingModule],
      controllers: [LoadTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 100 concurrent requests', async () => {
      const concurrentRequests = 100;
      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/load-test/fixed'));

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.status === 200).length;
      const blockedCount = responses.filter(r => r.status === 429).length;

      expect(successCount + blockedCount).toBe(concurrentRequests);
      expect(successCount).toBeLessThanOrEqual(1000);
    });

    it('should handle burst traffic with token bucket', async () => {
      // First burst
      const burst1 = await Promise.all(
        Array(100).fill(null).map(() =>
          request(app.getHttpServer()).get('/load-test/token')
        )
      );

      const burst1Success = burst1.filter(r => r.status === 200).length;
      expect(burst1Success).toBeGreaterThan(0);

      // Wait a bit for token refill
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second burst
      const burst2 = await Promise.all(
        Array(50).fill(null).map(() =>
          request(app.getHttpServer()).get('/load-test/token')
        )
      );

      const burst2Success = burst2.filter(r => r.status === 200).length;
      expect(burst2Success).toBeGreaterThan(0);
    });
  });

  describe('Sustained Load', () => {
    it('should handle sustained load over time', async () => {
      const duration = 5000; // 5 seconds
      const interval = 100; // 100ms between batches
      const batchSize = 10;

      const results = {
        success: 0,
        blocked: 0,
        errors: 0,
      };

      const startTime = Date.now();

      while (Date.now() - startTime < duration) {
        const batch = await Promise.all(
          Array(batchSize).fill(null).map(() =>
            request(app.getHttpServer())
              .get('/load-test/sliding')
              .catch(() => null)
          )
        );

        batch.forEach(response => {
          if (!response) {
            results.errors++;
          } else if (response.status === 200) {
            results.success++;
          } else if (response.status === 429) {
            results.blocked++;
          }
        });

        await new Promise(resolve => setTimeout(resolve, interval));
      }

      expect(results.success).toBeGreaterThan(0);
      expect(results.errors).toBe(0);
    });
  });

  describe('Memory and Performance', () => {
    it('should not leak memory under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate load
      for (let i = 0; i < 10; i++) {
        await Promise.all(
          Array(50).fill(null).map(() =>
            request(app.getHttpServer()).get('/load-test/fixed')
          )
        );
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (less than 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
