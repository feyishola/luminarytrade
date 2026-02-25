# Distributed Tracing with OpenTelemetry

Comprehensive distributed tracing implementation for tracking requests across service boundaries, identifying performance bottlenecks, and debugging issues.

## Features

- **Automatic Instrumentation**: HTTP requests, database queries, Redis operations
- **Custom Spans**: Create spans for business logic operations
- **Trace Context Propagation**: Maintain trace context across async operations
- **Span Enrichment**: Add custom attributes, events, and metadata
- **Error Tracking**: Automatic exception recording with stack traces
- **Performance Metrics**: Track operation duration and resource usage
- **Jaeger Integration**: Export traces to Jaeger for visualization

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      TracingModule                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │ TracingService   │      │ TracingMiddleware│           │
│  │                  │      │                  │           │
│  │ - SDK Setup      │      │ - Extract Context│           │
│  │ - Span Creation  │      │ - Enrich Spans   │           │
│  │ - Context Mgmt   │      │ - Add Headers    │           │
│  └──────────────────┘      └──────────────────┘           │
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │TracingInterceptor│      │  Tracing Plugins │           │
│  │                  │      │                  │           │
│  │ - Controller     │      │ - TypeORM        │           │
│  │   Tracing        │      │ - Bull Queue
```
