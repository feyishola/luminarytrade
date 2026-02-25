import * as api from '@opentelemetry/api';

/**
 * Utility functions for tracing async operations
 */

/**
 * Wrap a Promise with tracing
 */
export async function tracePromise<T>(
  tracer: api.Tracer,
  name: string,
  promise: Promise<T>,
  attributes?: api.Attributes,
): Promise<T> {
  const span = tracer.startSpan(name, {
    kind: api.SpanKind.INTERNAL,
  });

  if (attributes) {
    span.setAttributes(attributes);
  }

  const context = api.trace.setSpan(api.context.active(), span);

  try {
    const result = await api.context.with(context, () => promise);
    span.setStatus({ code: api.SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Wrap Promise.all with tracing
 */
export async function tracePromiseAll<T>(
  tracer: api.Tracer,
  name: string,
  promises: Promise<T>[],
): Promise<T[]> {
  const span = tracer.startSpan(name, {
    kind: api.SpanKind.INTERNAL,
  });

  span.setAttribute('promise.count', promises.length);

  const context = api.trace.setSpan(api.context.active(), span);

  try {
    const results = await api.context.with(context, () => Promise.all(promises));
    span.setStatus({ code: api.SpanStatusCode.OK });
    return results;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Wrap async function with tracing
 */
export function traceAsync<T extends (...args: any[]) => Promise<any>>(
  tracer: api.Tracer,
  name: string,
  fn: T,
): T {
  return (async (...args: any[]) => {
    const span = tracer.startSpan(name, {
      kind: api.SpanKind.INTERNAL,
    });

    const context = api.trace.setSpan(api.context.active(), span);

    try {
      const result = await api.context.with(context, () => fn(...args));
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }) as T;
}

/**
 * Create a child span from current context
 */
export function createChildSpan(
  tracer: api.Tracer,
  name: string,
  options?: api.SpanOptions,
): api.Span {
  const currentSpan = api.trace.getSpan(api.context.active());
  
  if (currentSpan) {
    const spanContext = currentSpan.spanContext();
    return tracer.startSpan(name, {
      ...options,
      links: [{ context: spanContext }],
    });
  }

  return tracer.startSpan(name, options);
}
