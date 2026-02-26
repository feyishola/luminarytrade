import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MiddlewarePipeline } from './pipeline';
import { LoggingMiddleware } from './middlewares/logging.middleware';
import { AuthenticationMiddleware } from './middlewares/authentication.middleware';
import { ValidationMiddleware } from './middlewares/validation.middleware';
import { ErrorHandlingMiddleware } from './middlewares/error-handling.middleware';
import { RateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { CorsMiddleware } from './middlewares/cors.middleware';
import { RateLimitingModule } from '../rate-limiting/rate-limiting.module';
import { AuthModule } from '../auth/auth.module';
import { ResponseTransformInterceptor } from './interceptors/response-transform.interceptor';

@Global()
@Module({
  imports: [ConfigModule, JwtModule.register({}), RateLimitingModule, AuthModule],
  providers: [
    MiddlewarePipeline,
    LoggingMiddleware,
    AuthenticationMiddleware,
    ValidationMiddleware,
    ErrorHandlingMiddleware,
    RateLimitMiddleware,
    CorsMiddleware,
    ResponseTransformInterceptor,
  ],
  exports: [
    MiddlewarePipeline,
    LoggingMiddleware,
    AuthenticationMiddleware,
    ValidationMiddleware,
    ErrorHandlingMiddleware,
    RateLimitMiddleware,
    CorsMiddleware,
    ResponseTransformInterceptor,
  ],
})
export class MiddlewarePipelineModule {}
