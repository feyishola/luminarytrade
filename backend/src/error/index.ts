// Module
export { AsyncErrorHandlingModule } from './async-error-handling.module';
export type { AsyncErrorHandlingModuleOptions } from './async-error-handling.module';

// Constants
export * from './constants/async-error.constants';

// Interfaces
export * from './interfaces/async-handler.interface';

// Errors
export {
  AppAsyncError,
  TimeoutError,
  CancellationError,
  CircuitOpenError,
  RetryExhaustedError,
  GeneratorError,
  AsyncErrorFactory,
} from './utils/error-context.util';

// Utilities
export { withRetry, withRetryValue, computeBackoffDelay } from './utils/retry.util';
export {
  withTimeout,
  parallelAll,
  parallelSettled,
  raceAll,
} from './utils/promise-composition.util';
export {
  collectStream,
  batchStream,
  mapStream,
  filterStream,
  paginatedGenerator,
} from './utils/async-iterator.util';
export {
  CancellationToken,
  raceWithCancellation,
} from './utils/cancellation.util';

// Circuit Breaker
export { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';

// Decorators
export {
  AsyncHandler,
  Retry,
  Timeout,
  WithCircuitBreaker,
} from './decorators/async-handler.decorator';

// Filters & Interceptors (for manual registration)
export { AsyncExceptionFilter } from './filters/async-exception.filter';
export { AsyncErrorInterceptor } from './interceptors/async-error.interceptor';
