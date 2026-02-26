import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Query } from '@nestjs/common';
import * as request from 'supertest';
import { MiddlewarePipelineModule } from '../../middleware-pipeline/middleware-pipeline.module';
import { MiddlewarePipeline } from '../pipeline';
import { LoggingMiddleware } from '../middlewares/logging.middleware';
import { AuthenticationMiddleware } from '../middlewares/authentication.middleware';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { ErrorHandlingMiddleware } from '../middlewares/error-handling.middleware';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { CorsMiddleware } from '../middlewares/cors.middleware';
import { wrap } from '../adapters/express-wrapper';

@Controller('test')
class TestController {
  @Get('ok')
  ok() {
    return { message: 'ok' };
  }
}

describe('MiddlewarePipeline', () => {
  let app: INestApplication;
  let pipeline: MiddlewarePipeline;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MiddlewarePipelineModule],
      controllers: [TestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    pipeline = app.get(MiddlewarePipeline);

    const logging = app.get(LoggingMiddleware);
    const auth = app.get(AuthenticationMiddleware);
    const validation = app.get(ValidationMiddleware);
    const rate = app.get(RateLimitMiddleware);
    const cors = app.get(CorsMiddleware);
    const errorHandler = app.get(ErrorHandlingMiddleware);
    rate.configure({ block: false, maxRequests: 1000 });

    const boom = wrap('BoomMiddleware', (req, _res, next) => {
      if (req.query['boom'] === '1') {
        return next(new Error('boom'));
      }
      next();
    });

    pipeline
      .register(cors)
      .register(logging)
      .register(boom)
      .useWhen((req) => !!req.headers.authorization, auth)
      .register(validation)
      .register(rate)
      .register(errorHandler);

    app.use(pipeline.build());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('composes and runs middleware in order', async () => {
    const res = await request(app.getHttpServer())
      .get('/test/ok')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('ok');
  });

  it('applies conditional authentication when header present', async () => {
    const res = await request(app.getHttpServer())
      .get('/test/ok')
      .set('Authorization', 'Bearer invalid')
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('formats errors from middleware', async () => {
    const res = await request(app.getHttpServer())
      .get('/test/ok')
      .query({ boom: '1' })
      .expect(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
  });
});
