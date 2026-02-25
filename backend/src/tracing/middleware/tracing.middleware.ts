import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TracingService } from '../tracing.service';
import * as api from '@opentelemetry/api';

@Injectable()
export class TracingMiddleware implements NestMiddleware {
  constructor(private tracingService: TracingService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Extract trace context from incoming request headers
    const context = this.tracingService.extractContext(req.headers);

    // Execute the request within the extracted context
    api.context.with(context, () => {
      const span = this.tracingService.getCurrentSpan();

      if (span) {
        // Enrich span with request details
        span.setAttributes({
          'http.method': req.method,
          'http.url': req.url,
          'http.route': req.route?.path || req.path,
          'http.user_agent': req.get('user-agent') || 'unknown',
          'http.client_ip': req.ip,
        });

        // Add user context if available
        if (req['user']) {
          span.setAttribute('user.id', req['user'].id);
          span.setAttribute('user.email', req['user'].email);
        }

        // Add wallet context if available
        if (req['wallet']) {
          span.setAttribute('wallet.address', req['wallet'].address);
        }

        // Store trace ID in request for logging correlation
        req['traceId'] = this.tracingService.getTraceId();
        req['spanId'] = this.tracingService.getSpanId();

        // Add trace ID to response headers
        res.setHeader('X-Trace-Id', req['traceId'] || '');

        // Track response
        const originalSend = res.send;
        res.send = function (data) {
          span.setAttribute('http.status_code', res.statusCode);
          span.setAttribute('http.response_content_length', res.get('content-length') || 0);

          if (res.statusCode >= 400) {
            span.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: `HTTP ${res.statusCode}`,
            });
          }

          return originalSend.call(this, data);
        };
      }

      next();
    });
  }
}
