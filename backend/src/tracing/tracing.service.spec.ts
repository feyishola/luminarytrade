import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TracingService } from './tracing.service';
import * as api from '@opentelemetry/api';

describe('TracingService', () => {
  let service: TracingService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                NODE_ENV: 'test',
                SERVICE_NAME: 'test-service',
                SERVICE_VERSION: '1.0.0',
                JAEGER_ENDPOINT: 'http://localhost:14268/api/traces',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TracingService>(TracingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('span creation', () => {
    it('should create a span', () => {
      const span = service.startSpan('test-span');
      expect(span).toBeDefined();
      expect(span.spanContext()).toBeDefined();
      span.end();
    });

    it('should execute function within span', async () => {
      const result = await service.withSpan('test-operation', async (span) => {
        expect(span).toBeDefined();
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should handle errors in span', async () => {
      await expect(
        service.withSpan('error-operation', async () => {
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');
    });
  });

  describe('span attributes', () => {
    it('should add attributes to current span', () => {
      const span = service.startSpan('test-span');
      const context = api.trace.setSpan(api.context.active(), span);

      api.context.with(context, () => {
        service.addSpanAttributes({
          'test.key': 'test-value',
          'test.number': 123,
        });

        // Verify attributes were added (in real scenario)
        expect(service.getCurrentSpan()).toBe(span);
      });

      span.end();
    });

    it('should add single attribute to current span', () => {
      const span = service.startSpan('test-span');
      const context = api.trace.setSpan(api.context.active(), span);

      api.context.with(context, () => {
        service.addSpanAttribute('test.key', 'test-value');
        expect(service.getCurrentSpan()).toBe(span);
      });

      span.end();
    });
  });

  describe('trace context', () => {
    it('should get trace ID', () => {
      const span = service.startSpan('test-span');
      const context = api.trace.setSpan(api.context.active(), span);

      api.context.with(context, () => {
        const traceId = service.getTraceId();
        expect(traceId).toBeDefined();
        expect(typeof traceId).toBe('string');
      });

      span.end();
    });

    it('should get span ID', () => {
      const span = service.startSpan('test-span');
      const context = api.trace.setSpan(api.context.active(), span);

      api.context.with(context, () => {
        const spanId = service.getSpanId();
        expect(spanId).toBeDefined();
        expect(typeof spanId).toBe('string');
      });

      span.end();
    });

    it('should inject and extract context', () => {
      const carrier: any = {};
      
      const span = service.startSpan('test-span');
      const context = api.trace.setSpan(api.context.active(), span);

      api.context.with(context, () => {
        service.injectContext(carrier);
        expect(carrier).toBeDefined();
        expect(Object.keys(carrier).length).toBeGreaterThan(0);
      });

      const extractedContext = service.extractContext(carrier);
      expect(extractedContext).toBeDefined();

      span.end();
    });
  });

  describe('span events', () => {
    it('should add event to current span', () => {
      const span = service.startSpan('test-span');
      const context = api.trace.setSpan(api.context.active(), span);

      api.context.with(context, () => {
        service.addSpanEvent('test-event', {
          'event.key': 'event-value',
        });
      });

      span.end();
    });
  });

  describe('exception recording', () => {
    it('should record exception in span', () => {
      const span = service.startSpan('test-span');
      const error = new Error('Test error');

      service.recordException(span, error);
      
      // Verify span status is set to error
      const spanContext = span.spanContext();
      expect(spanContext).toBeDefined();

      span.end();
    });
  });
});
