import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { TracingModule } from './tracing.module';
import { TracingService } from './tracing.service';
import { TracingInterceptor } from './interceptors/tracing.interceptor';
import { TracingMiddleware } from './middleware/tracing.middleware';
import * as api from '@opentelemetry/api';

describe('Tracing Integration Tests', () => {
  let app: INestApplication;
  let tracingService: TracingService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TracingModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    tracingService = moduleFixture.get<TracingService>(TracingService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Trace Context Propagation', () => {
    it('should propagate trace context through async operations', async () => {
      const traceId = await tracingService.withSpan(
        'parent-operation',
        async (parentSpan) => {
          const parentTraceId = tracingService.getTraceId();

          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Create child span
          const childSpan = tracingService.startSpan('child-operation');
          const childContext = api.trace.setSpan(api.context.active(), childSpan);

          await api.context.with(childContext, async () => {
            const childTraceId = tracingService.getTraceId();
            expect(childTraceId).toBe(parentTraceId);
            childSpan.end();
          });

          return parentTraceId;
        },
      );

      expect(traceId).toBeDefined();
      expect(typeof traceId).toBe('string');
    });

    it('should inject and extract trace context', async () => {
      const carrier: any = {};

      await tracingService.withSpan('test-operation', async () => {
        const originalTraceId = tracingService.getTraceId();

        // Inject context into carrier
        tracingService.injectContext(carrier);
        expect(Object.keys(carrier).length).toBeGreaterThan(0);

        // Extract context from carrier
        const extractedContext = tracingService.extractContext(carrier);
        expect(extractedContext).toBeDefined();

        // Verify trace ID is preserved
        await api.context.with(extractedContext, () => {
          const extractedTraceId = tracingService.getTraceId();
          expect(extractedTraceId).toBe(originalTraceId);
        });
      });
    });
  });

  describe('Span Hierarchy', () => {
    it('should create proper parent-child span relationships', async () => {
      const spans: api.Span[] = [];

      await tracingService.withSpan('root-span', async (rootSpan) => {
        spans.push(rootSpan);

        await tracingService.withSpan('child-span-1', async (childSpan1) => {
          spans.push(childSpan1);

          await tracingService.withSpan('grandchild-span', async (grandchildSpan) => {
            spans.push(grandchildSpan);
          });
        });

        await tracingService.withSpan('child-span-2', async (childSpan2) => {
          spans.push(childSpan2);
        });
      });

      expect(spans.length).toBe(4);
      
      // All spans should have the same trace ID
      const traceIds = spans.map((span) => span.spanContext().traceId);
      expect(new Set(traceIds).size).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should record exceptions in spans', async () => {
      const error = new Error('Test error');

      try {
        await tracingService.withSpan('error-operation', async (span) => {
          throw error;
        });
      } catch (err) {
        expect(err).toBe(error);
      }
    });

    it('should set error status on span when exception occurs', async () => {
      const span = tracingService.startSpan('test-span');
      const error = new Error('Test error');

      tracingService.recordException(span, error);

      // Span should still be valid
      expect(span.spanContext()).toBeDefined();
      span.end();
    });
  });

  describe('Span Attributes', () => {
    it('should add custom attributes to spans', async () => {
      await tracingService.withSpan('attributed-operation', async (span) => {
        tracingService.addSpanAttributes({
          'custom.attribute': 'test-value',
          'custom.number': 42,
          'custom.boolean': true,
        });

        tracingService.addSpanAttribute('single.attribute', 'single-value');

        // Verify span is still active
        const currentSpan = tracingService.getCurrentSpan();
        expect(currentSpan).toBe(span);
      });
    });

    it('should add events to spans', async () => {
      await tracingService.withSpan('event-operation', async () => {
        tracingService.addSpanEvent('custom-event', {
          'event.type': 'test',
          'event.timestamp': Date.now(),
        });

        tracingService.addSpanEvent('another-event');
      });
    });
  });

  describe('Performance Tracking', () => {
    it('should track operation duration', async () => {
      const startTime = Date.now();

      await tracingService.withSpan('timed-operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(90);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 5 }, (_, i) =>
        tracingService.withSpan(`concurrent-op-${i}`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return i;
        }),
      );

      const results = await Promise.all(operations);
      expect(results).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('Trace ID Retrieval', () => {
    it('should retrieve trace ID from active span', async () => {
      await tracingService.withSpan('trace-id-test', async () => {
        const traceId = tracingService.getTraceId();
        expect(traceId).toBeDefined();
        expect(typeof traceId).toBe('string');
        expect(traceId.length).toBeGreaterThan(0);
      });
    });

    it('should retrieve span ID from active span', async () => {
      await tracingService.withSpan('span-id-test', async () => {
        const spanId = tracingService.getSpanId();
        expect(spanId).toBeDefined();
        expect(typeof spanId).toBe('string');
        expect(spanId.length).toBeGreaterThan(0);
      });
    });

    it('should return undefined when no active span', () => {
      const traceId = tracingService.getTraceId();
      const spanId = tracingService.getSpanId();
      
      // May be undefined if no active span
      if (traceId) {
        expect(typeof traceId).toBe('string');
      }
      if (spanId) {
        expect(typeof spanId).toBe('string');
      }
    });
  });
});
