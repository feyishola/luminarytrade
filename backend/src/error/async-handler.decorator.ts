import { Inject, Logger } from '@nestjs/common';
import {
  ASYNC_ERROR_METADATA,
  CIRCUIT_BREAKER_METADATA,
  RETRY_OPTIONS_METADATA,
  TIMEOUT_OPTIONS_METADATA,
} from '../constants/async-error.constants';
import {
  AsyncHandlerOptions,
  CircuitBreakerOptions,
  ErrorContext,
  RetryOptions,
  TimeoutOptions,
} from '../interfaces/async-handler.interface';
import { AsyncErrorFactory } from '../utils/error-context.util';
import { withRetryValue } from '../utils/retry.util';
import { withTimeout } from '../utils/promise-composition.util';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';

const logger = new Logger('AsyncDecorators');

// ─── @AsyncHandler ───────────────────────────────────────────────────────────

/**
 * Wraps a method with standardized error handling, optional retry, timeout, and circuit breaker.
 *
 * @example
 * @AsyncHandler({ operation: 'fetchUser', retryOptions: { maxAttempts: 3 } })
 * async getUser(id: string): Promise<User> { ... }
 */
export function AsyncHandler(options: AsyncHandlerOptions = {}): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original: (...args: unknown[]) => Promise<unknown> = descriptor.value;
    const operation = options.operation ?? String(propertyKey);

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const baseContext: Partial<ErrorContext> = {
        operation,
        service: target.constructor?.name,
        timestamp: new Date(),
        ...(options.contextExtractor ? options.contextExtractor(args) : {}),
      };

      const invoke = async () => {
        // Circuit breaker wrapping
        const cbService = (this as Record<string, unknown>)['circuitBreakerService'] as
          | CircuitBreakerService
          | undefined;

        if (options.circuitBreakerKey && cbService) {
          return cbService.execute(options.circuitBreakerKey, () => original.apply(this, args));
        }

        return original.apply(this, args);
      };

      try {
        // Timeout wrapping
        if (options.timeoutOptions?.timeoutMs) {
          const { timeoutMs } = options.timeoutOptions;
          const result = await withTimeout(
            options.retryOptions
              ? withRetryValue(invoke, options.retryOptions, operation)
              : invoke(),
            { timeoutMs, operation },
          );
          return result;
        }

        // Retry only
        if (options.retryOptions) {
          return await withRetryValue(invoke, options.retryOptions, operation);
        }

        return await invoke();
      } catch (err) {
        const contextual = AsyncErrorFactory.wrap(err, baseContext);
        if (options.rethrow !== false) {
          throw contextual;
        }
        logger.error(`AsyncHandler caught error in "${operation}"`, contextual.toJSON());
        return undefined;
      }
    };

    Reflect.defineMetadata(ASYNC_ERROR_METADATA, options, descriptor.value);
    return descriptor;
  };
}

// ─── @Retry ──────────────────────────────────────────────────────────────────

/**
 * @example
 * @Retry({ maxAttempts: 5, delayMs: 200 })
 * async fetchData(): Promise<Data> { ... }
 */
export function Retry(options: RetryOptions = {}): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original: (...args: unknown[]) => Promise<unknown> = descriptor.value;
    const operation = String(propertyKey);

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      return withRetryValue(() => original.apply(this, args), options, operation);
    };

    Reflect.defineMetadata(RETRY_OPTIONS_METADATA, options, descriptor.value);
    return descriptor;
  };
}

// ─── @Timeout ────────────────────────────────────────────────────────────────

/**
 * @example
 * @Timeout({ timeoutMs: 5000 })
 * async fetchRemoteData(): Promise<Data> { ... }
 */
export function Timeout(options: TimeoutOptions): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original: (...args: unknown[]) => Promise<unknown> = descriptor.value;
    const operation = String(propertyKey);
    const timeoutMs = options.timeoutMs ?? 30_000;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      return withTimeout(original.apply(this, args) as Promise<unknown>, {
        timeoutMs,
        operation,
        signal: options.signal,
      });
    };

    Reflect.defineMetadata(TIMEOUT_OPTIONS_METADATA, options, descriptor.value);
    return descriptor;
  };
}

// ─── @WithCircuitBreaker ────────────────────────────────────────────────────

/**
 * @example
 * @WithCircuitBreaker('payment-gateway', { threshold: 3, resetTimeoutMs: 30000 })
 * async chargeCard(payload: ChargeDto): Promise<Receipt> { ... }
 */
export function WithCircuitBreaker(
  circuitKey: string,
  options: CircuitBreakerOptions = {},
): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original: (...args: unknown[]) => Promise<unknown> = descriptor.value;

    descriptor.value = async function (this: Record<string, unknown>, ...args: unknown[]) {
      const cbService = this['circuitBreakerService'] as CircuitBreakerService | undefined;

      if (!cbService) {
        logger.warn(
          `@WithCircuitBreaker: no CircuitBreakerService injected into ${target.constructor?.name}. Falling through.`,
        );
        return original.apply(this, args);
      }

      cbService.register(circuitKey, options);
      return cbService.execute(circuitKey, () => original.apply(this, args));
    };

    Reflect.defineMetadata(CIRCUIT_BREAKER_METADATA, { circuitKey, options }, descriptor.value);
    return descriptor;
  };
}
