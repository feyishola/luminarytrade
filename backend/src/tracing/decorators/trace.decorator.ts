import { SetMetadata } from '@nestjs/common';

export const TRACE_METADATA_KEY = 'trace:enabled';
export const TRACE_NAME_KEY = 'trace:name';

/**
 * Decorator to enable tracing for a method
 * @param spanName Optional custom span name
 */
export const Trace = (spanName?: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(TRACE_METADATA_KEY, true)(target, propertyKey, descriptor);
    if (spanName) {
      SetMetadata(TRACE_NAME_KEY, spanName)(target, propertyKey, descriptor);
    }
    return descriptor;
  };
};

/**
 * Decorator to add custom attributes to the current span
 */
export const SpanAttribute = (key: string, value: any) => {
  return SetMetadata(`span:attribute:${key}`, value);
};
