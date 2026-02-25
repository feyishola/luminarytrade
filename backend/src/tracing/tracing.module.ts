import { Module, Global } from '@nestjs/common';
import { TracingService } from './tracing.service';
import { TracingInterceptor } from './interceptors/tracing.interceptor';
import { TracingMiddleware } from './middleware/tracing.middleware';

@Global()
@Module({
  providers: [TracingService, TracingInterceptor, TracingMiddleware],
  exports: [TracingService, TracingInterceptor, TracingMiddleware],
})
export class TracingModule {}
