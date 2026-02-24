import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as api from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor, BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-node';

@Injectable()
export class TracingService implements OnModuleInit {
  private sdk: NodeSDK;
  private tracer: api.Tracer;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTracing();
  }

  private async initializeTracing() {
    const environment = this.configService.get('NODE_ENV', 'development');
    const serviceName = this.configService.get('SERVICE_NAME', 'chenaikit-backend');
    const serviceVersion = this.configService.get('SERVICE_VERSION', '0.1.0');
    const jaegerEndpoint = this.configService.get('JAEGER_ENDPOINT', 'http://localhost:14268/api/traces');
    const tracingDisabled = this.configService.get('TRACING_DISABLED', 'false') === 'true';

    if (environment === 'test' || tracingDisabled) {
      const provider = new BasicTracerProvider();
      provider.register({
        contextManager: new AsyncLocalStorageContextManager().enable(),
      });
      this.tracer = api.trace.getTracer(serviceName, serviceVersion);
      return;
    }

    // Configure sampler based on environment
    const sampler = this.createSampler(environment);

    // Create Jaeger exporter
    const jaegerExporter = new JaegerExporter({
      endpoint: jaegerEndpoint,
    });

    // Initialize SDK
    this.sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
      }),
      spanProcessor: new BatchSpanProcessor(jaegerExporter),
      sampler,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable fs instrumentation to reduce noise
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span, request) => {
              span.setAttribute('http.request.headers', JSON.stringify(request.headers));
            },
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
            enhancedDatabaseReporting: true,
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
          },
        }),
      ],
    });

    await this.sdk.start();
    this.tracer = api.trace.getTracer(serviceName, serviceVersion);

    console.log('🔍 OpenTelemetry tracing initialized');
    console.log(`📊 Exporting traces to: ${jaegerEndpoint}`);
  }

  private createSampler(environment: string): api.Sampler {
    if (environment === 'production') {
      // Sample 10% of traces in production
      return new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(0.1),
      });
    }
    // Sample all traces in development
    return new AlwaysOnSampler();
  }

  getTracer(): api.Tracer {
    if (!this.tracer) {
      const serviceName = this.configService.get('SERVICE_NAME', 'chenaikit-backend');
      const serviceVersion = this.configService.get('SERVICE_VERSION', '0.1.0');
      const environment = this.configService.get('NODE_ENV', 'development');

      if (environment === 'test') {
        const provider = new BasicTracerProvider();
        provider.register({
          contextManager: new AsyncLocalStorageContextManager().enable(),
        });
      }

      this.tracer = api.trace.getTracer(serviceName, serviceVersion);
    }
    return this.tracer;
  }

  /**
   * Create a custom span for business logic
   */
  startSpan(name: string, options?: api.SpanOptions): api.Span {
    return this.getTracer().startSpan(name, options);
  }

  /**
   * Execute a function within a span context
   */
  async withSpan<T>(
    name: string,
    fn: (span: api.Span) => Promise<T>,
    options?: api.SpanOptions,
  ): Promise<T> {
    const span = this.startSpan(name, options);
    const context = api.trace.setSpan(api.context.active(), span);

    try {
      const result = await api.context.with(context, () => fn(span));
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error) {
      this.recordException(span, error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get the current active span
   */
  getCurrentSpan(): api.Span | undefined {
    return api.trace.getSpan(api.context.active());
  }

  /**
   * Add attributes to the current span
   */
  addSpanAttributes(attributes: api.Attributes): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Add a single attribute to the current span
   */
  addSpanAttribute(key: string, value: api.AttributeValue): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }

  /**
   * Add an event to the current span
   */
  addSpanEvent(name: string, attributes?: api.Attributes): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Record an exception in the current span
   */
  recordException(span: api.Span, error: Error): void {
    span.recordException(error);
    span.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: error.message,
    });
  }

  /**
   * Get trace ID from current context
   */
  getTraceId(): string | undefined {
    const span = this.getCurrentSpan();
    if (span) {
      const spanContext = span.spanContext();
      return spanContext.traceId;
    }
    return undefined;
  }

  /**
   * Get span ID from current context
   */
  getSpanId(): string | undefined {
    const span = this.getCurrentSpan();
    if (span) {
      const spanContext = span.spanContext();
      return spanContext.spanId;
    }
    return undefined;
  }

  /**
   * Inject trace context into carrier (for propagation)
   */
  injectContext(carrier: any): void {
    api.propagation.inject(api.context.active(), carrier);
  }

  /**
   * Extract trace context from carrier
   */
  extractContext(carrier: any): api.Context {
    return api.propagation.extract(api.context.active(), carrier);
  }

  async onModuleDestroy() {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }
}
