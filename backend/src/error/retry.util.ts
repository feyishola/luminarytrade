import {
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_BACKOFF_FACTOR,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_JITTER_FACTOR,
  DEFAULT_RETRY_MAX_DELAY_MS,
} from '../constants/async-error.constants';
import { RetryOptions, RetryResult } from '../interfaces/async-handler.interface';
import { AsyncErrorFactory, RetryExhaustedError } from './error-context.util';
import { CancellationError } from './error-context.util';

/**
 * Compute the delay for a given attempt using exponential backoff + jitter.
 *
 *   delay = min(base * factor^(attempt-1), maxDelay) * (1 ± jitter)
 */
export function computeBackoffDelay(
  attempt: number,
  options: Required<
    Pick<RetryOptions, 'delayMs' | 'maxDelayMs' | 'backoffFactor' | 'jitterFactor'>
  >,
): number {
  const { delayMs, maxDelayMs, backoffFactor, jitterFactor } = options;
  const exponential = delayMs * Math.pow(backoffFactor, attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);
  const jitter = capped * jitterFactor * (Math.random() * 2 - 1); // ±jitter
  return Math.max(0, Math.round(capped + jitter));
}

/**
 * Sleep for `ms` milliseconds, aborting early if `signal` is cancelled.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CancellationError('sleep'));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new CancellationError('sleep'));
      },
      { once: true },
    );
  });
}

/**
 * Execute `fn` with retry logic, exponential backoff and jitter.
 *
 * @example
 * const result = await withRetry(() => fetchData(), {
 *   maxAttempts: 5,
 *   delayMs: 500,
 *   retryIf: (err) => err instanceof NetworkError,
 * });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  operation = 'operation',
): Promise<RetryResult<T>> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const delayMs = options.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
  const backoffFactor = options.backoffFactor ?? DEFAULT_RETRY_BACKOFF_FACTOR;
  const jitterFactor = options.jitterFactor ?? DEFAULT_JITTER_FACTOR;
  const { retryIf, onRetry, signal } = options;

  let lastError: Error = new Error('No attempts made');
  let totalDelayMs = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new CancellationError(operation);
    }

    try {
      const value = await fn();
      return { value, attempts: attempt, totalDelayMs };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Never retry cancellations
      if (AsyncErrorFactory.isCancellation(lastError)) {
        throw lastError;
      }

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt) break;

      const shouldRetry = retryIf
        ? await retryIf(lastError, attempt)
        : AsyncErrorFactory.isRetryable(lastError) !== false;

      if (!shouldRetry) break;

      const delay = computeBackoffDelay(attempt, { delayMs, maxDelayMs, backoffFactor, jitterFactor });
      totalDelayMs += delay;

      onRetry?.(lastError, attempt, delay);

      await sleep(delay, signal);
    }
  }

  throw new RetryExhaustedError(operation, maxAttempts, lastError);
}

/**
 * Convenience wrapper that strips the RetryResult metadata.
 */
export async function withRetryValue<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
  operation?: string,
): Promise<T> {
  const result = await withRetry(fn, options, operation);
  return result.value;
}
