import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get } from '@nestjs/common';
import * as request from 'supertest';
import { MiddlewarePipelineModule } from '../middleware-pipeline.module';
import { MiddlewarePipeline } from '../pipeline';
import { LoggingMiddleware } from '../middlewares/logging.middleware';
import { ErrorHandlingMiddleware } from '../middlewares/error-handling.middleware';

@Controller('perf')
class PerfController {
  @Get()
  ok() {
    return { ok: true };
  }
}

describe('Pipeline Performance', () => {
  let app: INestApplication;
  let pipeline: MiddlewarePipeline;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MiddlewarePipelineModule],
      controllers: [PerfController],
    }).compile();

    app = moduleFixture.createNestApplication();
    pipeline = app.get(MiddlewarePipeline);
    const logging = app.get(LoggingMiddleware);
    const errorHandler = app.get(ErrorHandlingMiddleware);
    pipeline.register(logging).register(errorHandler);
    app.use(pipeline.build());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('handles 200 requests quickly', async () => {
    const start = Date.now();
    for (let i = 0; i < 200; i++) {
      await request(app.getHttpServer()).get('/perf').expect(200);
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});
