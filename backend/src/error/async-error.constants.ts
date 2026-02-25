export const ASYNC_ERROR_METADATA = 'async_error_metadata';
export const RETRY_OPTIONS_METADATA = 'retry_options_metadata';
export const TIMEOUT_OPTIONS_METADATA = 'timeout_options_metadata';
export const CIRCUIT_BREAKER_METADATA = 'circuit_breaker_metadata';

export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_RETRY_DELAY_MS = 1000;
export const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;
export const DEFAULT_RETRY_BACKOFF_FACTOR = 2;
export const DEFAULT_JITTER_FACTOR = 0.1;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 5;
export const DEFAULT_CIRCUIT_BREAKER_RESET_MS = 60_000;
export const DEFAULT_CIRCUIT_BREAKER_HALF_OPEN_MAX = 3;

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export enum AsyncErrorCode {
  TIMEOUT = 'ASYNC_TIMEOUT',
  CANCELLED = 'ASYNC_CANCELLED',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  GENERATOR_ERROR = 'GENERATOR_ERROR',
  COMPOSITION_ERROR = 'COMPOSITION_ERROR',
}

export const ASYNC_ERROR_HANDLING_LOGGER = 'AsyncErrorHandlingLogger';
