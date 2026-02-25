import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TracingService } from '../tracing.service';
import * as api from '@opentelemetry/api';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(private tracingService: TracingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();

    const spanName = `${controller.name}.${handler.name}`;
    const span = this.tracingService.startSpan(spanName, {
      kind: api.SpanKind.INTERNAL,
    });

    const spanContext = api.trace.setSpan(api.context.active(), span);

    return api.context.with(spanContext, () => {
      // Add controller and handler information
      span.setAttributes({
        'code.function': handler.name,
        'code.namespace': controller.name,
        'component': 'nestjs-controller',
      });

      // Add request parameters
      const params = request.params;
      if (params && Object.keys(params).length > 0) {
        span.setAttribute('request.params', JSON.stringify(params));
      }

      // Add query parameters
      const query = request.query;
      if (query && Object.keys(query).length > 0) {
        span.setAttribute('request.query', JSON.stringify(query));
      }

      const startTime = Date.now();

      return next.handle().pipe(
        tap((data) => {
          const duration = Date.now() - startTime;
          span.setAttribute('handler.duration_ms', duration);
          span.setAttribute('response.type', typeof data);

          if (data && typeof data === 'object') {
            span.setAttribute('response.has_data', true);
            if (Array.isArray(data)) {
              span.setAttribute('response.array_length', data.length);
            }
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
          span.end();
        }),
        catchError((error) => {
          const duration = Date.now() - startTime;
          span.setAttribute('handler.duration_ms', duration);

          this.tracingService.recordException(span, error);
          span.end();

          throw error;
        }),
      );
    });
  }
}
