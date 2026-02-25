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
import { StartupService } from './startup/services/startup.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const startupService = app.get(StartupService);

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

  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  
  // Wait for startup service to complete before listening
  console.log('🔄 Waiting for startup sequence to complete...');
  
  // Check if startup is complete before starting the server
  const maxWaitTime = 60000; // 60 seconds max wait time
  const checkInterval = 1000; // Check every second
  let waitTime = 0;

  while (!startupService.isReady() && waitTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    waitTime += checkInterval;
  }

  if (!startupService.isReady()) {
    console.error('❌ Startup sequence failed to complete within timeout');
    process.exit(1);
  }

  await app.listen(port);
  
  console.log(`🚀 ChenAIKit Backend running on port ${port}`);
  console.log(`📡 Submitter service running on http://localhost:${port}`);
  console.log(`🛡️  Rate limiting enabled with adaptive strategies`);
  console.log(`🔍 Distributed tracing enabled - Jaeger UI: http://localhost:16686`);
  console.log(`🏥 Health endpoints available:`);
  console.log(`   - Startup: http://localhost:${port}/health/startup`);
  console.log(`   - Readiness: http://localhost:${port}/health/readiness`);
  console.log(`   - Liveness: http://localhost:${port}/health/liveness`);
  console.log(`   - Full Health: http://localhost:${port}/health`);
  
  // Log startup report
  const report = startupService.getStartupReport();
  if (report) {
    console.log(`✅ Startup completed in ${report.totalDuration}ms`);
    console.log(`📊 Startup phases: ${report.phases.map(p => `${p.phase}(${p.duration}ms)`).join(', ')}`);
  }
}

bootstrap().catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
