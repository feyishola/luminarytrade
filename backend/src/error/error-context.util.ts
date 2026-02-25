import { AsyncErrorCode } from '../constants/async-error.constants';
import { ContextualError, ErrorContext } from '../interfaces/async-handler.interface';

// ─── Base Contextual Error ───────────────────────────────────────────────────

export class AppAsyncError extends Error implements ContextualError {
  readonly context: ErrorContext;
  readonly originalError?: Error;
  readonly rootCause: Error;
  readonly chainedContexts: ErrorContext[];
  readonly code: string;
  readonly isRetryable: boolean;
  readonly isCancelled: boolean;

  constructor(
    message: string,
    options: {
      context: Partial<ErrorContext>;
      originalError?: Error;
      code?: string;
      isRetryable?: boolean;
      isCancelled?: boolean;
    },
  ) {
    super(message);
    this.name = this.constructor.name;

    this.context = {
      timestamp: new Date(),
      ...options.context,
    } as ErrorContext;

    this.originalError = options.originalError;
    this.code = options.code ?? 'ASYNC_ERROR';
    this.isRetryable = options.isRetryable ?? false;
    this.isCancelled = options.isCancelled ?? false;

    // Preserve original stack
    if (options.originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.originalError.stack}`;
    }

    // Chain contexts from original if it's also contextual
    const original = options.originalError as AppAsyncError | undefined;
    this.chainedContexts = original?.chainedContexts
      ? [...original.chainedContexts, original.context]
      : [];

    // Root cause traversal
    this.rootCause = this.findRootCause(options.originalError ?? this);

    // Capture stack at point of construction
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private findRootCause(error: Error): Error {
    let current: Error = error;
    const visited = new Set<Error>();
    while ((current as AppAsyncError).originalError && !visited.has(current)) {
      visited.add(current);
      current = (current as AppAsyncError).originalError!;
    }
    return current;
  }

  withContext(extra: Partial<ErrorContext>): AppAsyncError {
    return new AppAsyncError(this.message, {
      context: { ...this.context, ...extra },
      originalError: this.originalError,
      code: this.code,
      isRetryable: this.isRetryable,
      isCancelled: this.isCancelled,
    });
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      isRetryable: this.isRetryable,
      isCancelled: this.isCancelled,
      context: this.context,
      rootCause: {
        name: this.rootCause.name,
        message: this.rootCause.message,
      },
      chainedContexts: this.chainedContexts,
    };
  }
}

// ─── Typed Subclasses ────────────────────────────────────────────────────────

export class TimeoutError extends AppAsyncError {
  constructor(operation: string, timeoutMs: number, context: Partial<ErrorContext> = {}) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`, {
      context: { operation, ...context },
      code: AsyncErrorCode.TIMEOUT,
      isRetryable: true,
    });
  }
}

export class CancellationError extends AppAsyncError {
  constructor(operation: string, context: Partial<ErrorContext> = {}) {
    super(`Operation "${operation}" was cancelled`, {
      context: { operation, ...context },
      code: AsyncErrorCode.CANCELLED,
      isRetryable: false,
      isCancelled: true,
    });
  }
}

export class CircuitOpenError extends AppAsyncError {
  constructor(circuitKey: string, nextAttemptAt: Date, context: Partial<ErrorContext> = {}) {
    super(`Circuit "${circuitKey}" is OPEN. Next attempt at ${nextAttemptAt.toISOString()}`, {
      context: { operation: circuitKey, ...context },
      code: AsyncErrorCode.CIRCUIT_OPEN,
      isRetryable: false,
    });
  }
}

export class RetryExhaustedError extends AppAsyncError {
  readonly attempts: number;

  constructor(
    operation: string,
    attempts: number,
    lastError: Error,
    context: Partial<ErrorContext> = {},
  ) {
    super(`Operation "${operation}" failed after ${attempts} attempts`, {
      context: { operation, ...context },
      originalError: lastError,
      code: AsyncErrorCode.RETRY_EXHAUSTED,
      isRetryable: false,
    });
    this.attempts = attempts;
  }
}

export class GeneratorError extends AppAsyncError {
  constructor(operation: string, cause: Error, context: Partial<ErrorContext> = {}) {
    super(`Async generator "${operation}" encountered an error`, {
      context: { operation, ...context },
      originalError: cause,
      code: AsyncErrorCode.GENERATOR_ERROR,
      isRetryable: false,
    });
  }
}

// ─── Error Factory ───────────────────────────────────────────────────────────

export class AsyncErrorFactory {
  static wrap(error: unknown, context: Partial<ErrorContext> = {}): AppAsyncError {
    if (error instanceof AppAsyncError) {
      return context && Object.keys(context).length > 0 ? error.withContext(context) : error;
    }

    const normalized =
      error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));

    return new AppAsyncError(normalized.message, {
      context,
      originalError: normalized,
      code: 'WRAPPED_ERROR',
      isRetryable: false,
    });
  }

  static isCancellation(error: unknown): boolean {
    return (
      error instanceof CancellationError ||
      (error instanceof Error && error.name === 'AbortError') ||
      (error instanceof AppAsyncError && error.isCancelled)
    );
  }

  static isTimeout(error: unknown): boolean {
    return error instanceof TimeoutError;
  }

  static isRetryable(error: unknown): boolean {
    if (error instanceof AppAsyncError) return error.isRetryable;
    // Network-style errors are retryable by default
    if (error instanceof Error) {
      return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].some(
        (code) => (error as NodeJS.ErrnoException).code === code,
      );
    }
    return false;
  }
}
