import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { RateLimitGuard } from './rate-limiting/guards/rate-limit.guard';
import { SystemLoadMiddleware } from './rate-limiting/middleware/system-load.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

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
}

bootstrap();
