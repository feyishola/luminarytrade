import { CircuitState } from '../constants/async-error.constants';

// ─── Error Context ──────────────────────────────────────────────────────────

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  correlationId?: string;
  operation?: string;
  service?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ContextualError extends Error {
  context: ErrorContext;
  originalError?: Error;
  rootCause?: Error;
  chainedContexts: ErrorContext[];
  code?: string;
  isRetryable: boolean;
  isCancelled: boolean;
}

// ─── Retry ──────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Max number of attempts (including first call). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms. Default: 1000 */
  delayMs?: number;
  /** Maximum delay cap in ms. Default: 30000 */
  maxDelayMs?: number;
  /** Exponential backoff multiplier. Default: 2 */
  backoffFactor?: number;
  /** Jitter factor 0–1 applied to delay. Default: 0.1 */
  jitterFactor?: number;
  /** Predicate to decide if an error is retryable. Defaults to all errors. */
  retryIf?: (error: Error, attempt: number) => boolean | Promise<boolean>;
  /** Hook called before each retry. */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
  /** AbortSignal to cancel retries. */
  signal?: AbortSignal;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
  totalDelayMs: number;
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────

export interface CircuitBreakerOptions {
  /** Failures before opening. Default: 5 */
  threshold?: number;
  /** Ms to stay open before half-open. Default: 60000 */
  resetTimeoutMs?: number;
  /** Max half-open probe requests. Default: 3 */
  halfOpenMax?: number;
  /** Custom failure predicate. */
  isFailure?: (error: Error) => boolean;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export interface CircuitBreakerSnapshot {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt?: Date;
  nextAttemptAt?: Date;
}

// ─── Timeout ────────────────────────────────────────────────────────────────

export interface TimeoutOptions {
  /** Timeout in ms. Default: 30000 */
  timeoutMs?: number;
  /** Message for the timeout error. */
  message?: string;
  /** Signal to propagate into the inner operation. */
  signal?: AbortSignal;
}

// ─── Promise Composition ────────────────────────────────────────────────────

export interface SettledResult<T> {
  status: 'fulfilled' | 'rejected';
  value?: T;
  reason?: Error;
  index: number;
}

export interface ParallelOptions {
  /** Concurrency limit (default: unlimited) */
  concurrency?: number;
  /** If true, cancel pending on first failure */
  failFast?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

// ─── Async Generator / Streaming ────────────────────────────────────────────

export interface StreamOptions<T> {
  /** Called on each item */
  onItem?: (item: T, index: number) => void | Promise<void>;
  /** Called on stream end */
  onComplete?: (totalItems: number) => void | Promise<void>;
  /** Called on error — if returns true, stream continues */
  onError?: (error: Error, index: number) => boolean | Promise<boolean>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface StreamResult<T> {
  items: T[];
  totalItems: number;
  errors: Array<{ index: number; error: Error }>;
  cancelled: boolean;
  timedOut: boolean;
}

// ─── Decorator Metadata ──────────────────────────────────────────────────────

export interface AsyncHandlerOptions {
  operation?: string;
  retryOptions?: RetryOptions;
  timeoutOptions?: TimeoutOptions;
  circuitBreakerKey?: string;
  contextExtractor?: (args: unknown[]) => Partial<ErrorContext>;
  rethrow?: boolean;
}
