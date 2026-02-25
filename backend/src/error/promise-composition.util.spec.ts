import { withTimeout, parallelAll, parallelSettled, raceAll } from '../utils/promise-composition.util';
import { TimeoutError } from '../utils/error-context.util';
import { CancellationToken } from '../utils/cancellation.util';

describe('withTimeout', () => {
  jest.useFakeTimers();
  afterAll(() => jest.useRealTimers());

  it('resolves if promise completes before timeout', async () => {
    const promise = Promise.resolve('fast');
    await expect(withTimeout(promise, { timeoutMs: 1000, operation: 'test' })).resolves.toBe(
      'fast',
    );
  });

  it('throws TimeoutError if promise exceeds timeout', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 5000));
    const racePromise = withTimeout(slow, { timeoutMs: 100, operation: 'slowOp' });
    jest.advanceTimersByTime(200);
    await expect(racePromise).rejects.toBeInstanceOf(TimeoutError);
  });

  it('propagates cancellation from external signal', async () => {
    const token = new CancellationToken('external');
    const slow = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('late')), 5000),
    );

    const racePromise = withTimeout(slow, {
      timeoutMs: 10_000,
      operation: 'test',
      signal: token.signal,
    });

    token.cancel();
    jest.runAllTimers();

    await expect(racePromise).rejects.toMatchObject({ isCancelled: true });
    token.dispose();
  });
});

describe('parallelAll', () => {
  it('returns all results for succeeding tasks', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    ];
    await expect(parallelAll(tasks)).resolves.toEqual([1, 2, 3]);
  });

  it('throws on first failure with failFast=true (default)', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve(3),
    ];
    await expect(parallelAll(tasks)).rejects.toThrow('boom');
  });

  it('throws AggregateError when failFast=false and errors exist', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('e1')),
      () => Promise.reject(new Error('e2')),
    ];
    await expect(parallelAll(tasks, { failFast: false })).rejects.toBeInstanceOf(AggregateError);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 10 }, () => () => {
      active++;
      maxActive = Math.max(maxActive, active);
      return new Promise<number>((resolve) =>
        setTimeout(() => {
          active--;
          resolve(1);
        }, 10),
      );
    });

    const promise = parallelAll(tasks, { concurrency: 3 });
    await jest.runAllTimersAsync();
    await promise;

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('returns [] for empty tasks', async () => {
    await expect(parallelAll([])).resolves.toEqual([]);
  });
});

describe('parallelSettled', () => {
  it('returns fulfilled results', async () => {
    const tasks = [() => Promise.resolve('a'), () => Promise.resolve('b')];
    const results = await parallelSettled(tasks);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('includes rejected results without throwing', async () => {
    const tasks = [
      () => Promise.resolve('ok'),
      () => Promise.reject(new Error('fail')),
    ];
    const results = await parallelSettled(tasks);
    expect(results.find((r) => r.status === 'rejected')).toBeDefined();
    expect(results.find((r) => r.status === 'fulfilled')).toBeDefined();
  });

  it('assigns correct index to each result', async () => {
    const tasks = [
      () => Promise.resolve('first'),
      () => Promise.reject(new Error('second fail')),
      () => Promise.resolve('third'),
    ];
    const results = await parallelSettled(tasks);
    expect(results.find((r) => r.index === 1)?.status).toBe('rejected');
    expect(results.find((r) => r.index === 0)?.status).toBe('fulfilled');
  });
});

describe('raceAll', () => {
  it('returns fastest result', async () => {
    jest.useFakeTimers();
    const tasks = [
      () => new Promise<string>((r) => setTimeout(() => r('slow'), 500)),
      () => Promise.resolve('fast'),
    ];
    const promise = raceAll(tasks, { operation: 'race' });
    jest.runAllTimers();
    await expect(promise).resolves.toBe('fast');
    jest.useRealTimers();
  });
});
