import { computeBackoffDelay, withRetry, withRetryValue } from '../utils/retry.util';
import { CancellationToken } from '../utils/cancellation.util';
import { RetryExhaustedError } from '../utils/error-context.util';

describe('computeBackoffDelay', () => {
  const base = { delayMs: 1000, maxDelayMs: 30_000, backoffFactor: 2, jitterFactor: 0 };

  it('returns base delay on first attempt', () => {
    expect(computeBackoffDelay(1, base)).toBe(1000);
  });

  it('doubles each attempt', () => {
    expect(computeBackoffDelay(2, base)).toBe(2000);
    expect(computeBackoffDelay(3, base)).toBe(4000);
    expect(computeBackoffDelay(4, base)).toBe(8000);
  });

  it('caps at maxDelayMs', () => {
    expect(computeBackoffDelay(10, base)).toBe(30_000);
  });

  it('adds jitter when jitterFactor > 0', () => {
    const delays = Array.from({ length: 50 }, () =>
      computeBackoffDelay(1, { ...base, jitterFactor: 0.1 }),
    );
    const unique = new Set(delays);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('never returns negative', () => {
    const delay = computeBackoffDelay(1, { ...base, delayMs: 0 });
    expect(delay).toBeGreaterThanOrEqual(0);
  });
});

describe('withRetry', () => {
  jest.useFakeTimers();

  afterEach(() => jest.clearAllMocks());
  afterAll(() => jest.useRealTimers());

  it('returns value on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on 3rd attempt', async () => {
    let calls = 0;
    const fn = jest.fn().mockImplementation(() => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('transient'));
      return Promise.resolve('success');
    });

    const retryPromise = withRetry(fn, { maxAttempts: 3, delayMs: 10, jitterFactor: 0 });
    // Advance through delays
    await jest.runAllTimersAsync();
    const result = await retryPromise;

    expect(result.value).toBe('success');
    expect(result.attempts).toBe(3);
  });

  it('throws RetryExhaustedError after max attempts', async () => {
    const err = new Error('persistent');
    const fn = jest.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { maxAttempts: 3, delayMs: 10, jitterFactor: 0 });
    await jest.runAllTimersAsync();

    await expect(promise).rejects.toBeInstanceOf(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls onRetry hook before each retry', async () => {
    const onRetry = jest.fn();
    const fn = jest.fn().mockRejectedValue(new Error('err'));

    const promise = withRetry(fn, { maxAttempts: 3, delayMs: 10, jitterFactor: 0, onRetry });
    await jest.runAllTimersAsync();
    await promise.catch(() => {});

    expect(onRetry).toHaveBeenCalledTimes(2); // attempts 1 and 2 retry
  });

  it('stops retrying when retryIf returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('non-retryable'));
    const retryIf = jest.fn().mockReturnValue(false);

    const promise = withRetry(fn, { maxAttempts: 5, delayMs: 10, retryIf });
    await jest.runAllTimersAsync();
    await promise.catch(() => {});

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborts retries when signal is cancelled', async () => {
    const token = new CancellationToken('test');
    const fn = jest.fn().mockImplementation(() => {
      token.cancel();
      return Promise.reject(new Error('err'));
    });

    const promise = withRetry(fn, { maxAttempts: 5, delayMs: 10, signal: token.signal });
    await jest.runAllTimersAsync();

    await expect(promise).rejects.toMatchObject({ isCancelled: true });
    expect(fn).toHaveBeenCalledTimes(1);

    token.dispose();
  });
});

describe('withRetryValue', () => {
  jest.useFakeTimers();
  afterAll(() => jest.useRealTimers());

  it('returns bare value', async () => {
    const promise = withRetryValue(() => Promise.resolve(42), { maxAttempts: 1 });
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe(42);
  });
});
