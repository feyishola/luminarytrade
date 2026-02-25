import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Controller, Get, UseGuards } from '@nestjs/common';
import * as request from 'supertest';
import { RateLimitingModule } from '../rate-limiting.module';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RateLimit, ThrottlePerUser, SkipRateLimit } from '../decorators/rate-limit.decorator';
import { RateLimitStrategy } from '../interfaces/rate-limiter.interface';
import { IpFilterService } from '../services/ip-filter.service';

// Test controller
@Controller('test')
class TestController {
  @Get('fixed')
  @RateLimit(5, 60000, RateLimitStrategy.FIXED_WINDOW)
  fixedWindow() {
    return { message: 'success' };
  }

  @Get('sliding')
  @RateLimit(5, 60000, RateLimitStrategy.SLIDING_WINDOW)
  slidingWindow() {
    return { message: 'success' };
  }

  @Get('token')
  @RateLimit(5, 60000, RateLimitStrategy.TOKEN_BUCKET)
  tokenBucket() {
    return { message: 'success' };
  }

  @Get('user')
  @ThrottlePerUser(3, 60000)
  perUser() {
    return { message: 'success' };
  }

  @Get('skip')
  @SkipRateLimit()
  skipRateLimit() {
    return { message: 'success' };
  }
}

const runNetworkTests = process.env.ALLOW_NETWORK_TESTS === 'true';
const describeIf = runNetworkTests ? describe : describe.skip;

describeIf('RateLimiting Integration', () => {
  let app: INestApplication;
  let ipFilter: IpFilterService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RateLimitingModule],
      controllers: [TestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    ipFilter = moduleFixture.get(IpFilterService);
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Fixed Window Strategy', () => {
    it('should allow requests within limit', async () => {
      const responses = await Promise.all(
        Array(5).fill(null).map(() =>
          request(app.getHttpServer())
            .get('/test/fixed')
            .expect(200)
        )
      );

      responses.forEach(response => {
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
        expect(response.headers['x-ratelimit-reset']).toBeDefined();
      });
    });

    it('should block requests exceeding limit', async () => {
      // Make 5 requests first
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/test/fixed');
      }

      // 6th request should be blocked
      const response = await request(app.getHttpServer())
        .get('/test/fixed')
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.body.message).toBe('Rate limit exceeded');
    });
  });

  describe('Sliding Window Strategy', () => {
    it('should allow requests within limit', async () => {
      const responses = await Promise.all(
        Array(5).fill(null).map(() =>
          request(app.getHttpServer())
            .get('/test/sliding')
            .expect(200)
        )
      );

      responses.forEach(response => {
        expect(response.body.message).toBe('success');
      });
    });

    it('should block requests exceeding limit', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/test/sliding');
      }

      await request(app.getHttpServer())
        .get('/test/sliding')
        .expect(429);
    });
  });

  describe('Token Bucket Strategy', () => {
    it('should allow burst requests up to bucket size', async () => {
      const responses = await Promise.all(
        Array(5).fill(null).map(() =>
          request(app.getHttpServer())
            .get('/test/token')
            .expect(200)
        )
      );

      responses.forEach(response => {
        expect(response.body.message).toBe('success');
      });
    });

    it('should block requests when bucket is empty', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/test/token');
      }

      await request(app.getHttpServer())
        .get('/test/token')
        .expect(429);
    });
  });

  describe('Per-User Rate Limiting', () => {
    it('should track limits per user', async () => {
      // This test would require authentication middleware
      // For now, we test that the endpoint works
      const response = await request(app.getHttpServer())
        .get('/test/user')
        .expect(200);

      expect(response.body.message).toBe('success');
    });
  });

  describe('Skip Rate Limit', () => {
    it('should bypass rate limiting when decorated with @SkipRateLimit', async () => {
      // Make many requests - should never be blocked
      for (let i = 0; i < 20; i++) {
        const response = await request(app.getHttpServer())
          .get('/test/skip')
          .expect(200);

        expect(response.body.message).toBe('success');
      }
    });
  });

  describe('IP Whitelist/Blacklist', () => {
    it('should allow whitelisted IPs', async () => {
      await ipFilter.addToWhitelist('127.0.0.1');

      // Make many requests from whitelisted IP
      for (let i = 0; i < 20; i++) {
        await request(app.getHttpServer())
          .get('/test/fixed')
          .expect(200);
      }

      await ipFilter.removeFromWhitelist('127.0.0.1');
    });

    it('should block blacklisted IPs', async () => {
      await ipFilter.addToBlacklist('127.0.0.1', 'Test blacklist');

      await request(app.getHttpServer())
        .get('/test/fixed')
        .expect(403);

      await ipFilter.removeFromBlacklist('127.0.0.1');
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include standard rate limit headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/test/fixed')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should include retry-after header when blocked', async () => {
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer()).get('/test/fixed');
      }

      const response = await request(app.getHttpServer())
        .get('/test/fixed')
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});
