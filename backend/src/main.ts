import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RateLimitGuard } from './rate-limiting/guards/rate-limit.guard';
import { SystemLoadMiddleware } from './rate-limiting/middleware/system-load.middleware';
import { TracingInterceptor } from './tracing/interceptors/tracing.interceptor';
import { TracingMiddleware } from './tracing/middleware/tracing.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const origins = (configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Apply tracing middleware
  const tracingMiddleware = app.get(TracingMiddleware);
  app.use(tracingMiddleware.use.bind(tracingMiddleware));

  app.useGlobalFilters(new GlobalExceptionFilter());

  // Apply tracing interceptor globally
  const tracingInterceptor = app.get(TracingInterceptor);
  app.useGlobalInterceptors(tracingInterceptor);

  // Apply rate limiting guard globally
  const rateLimitGuard = app.get(RateLimitGuard);
  app.useGlobalGuards(rateLimitGuard);

  // Apply system load monitoring middleware
  const systemLoadMiddleware = app.get(SystemLoadMiddleware);
  app.use(systemLoadMiddleware.use.bind(systemLoadMiddleware));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 ChenAIKit Backend running on port ${port}`);
  console.log(`📡 Submitter service running on http://localhost:${port}`);
  console.log(`🛡️  Rate limiting enabled with adaptive strategies`);
  console.log(`🔍 Distributed tracing enabled - Jaeger UI: http://localhost:16686`);
}

bootstrap();
