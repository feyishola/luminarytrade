import { TimeoutError } from './error-context.util';
import { CancellationToken, raceWithCancellation } from './cancellation.util';
import { ParallelOptions, SettledResult } from '../interfaces/async-handler.interface';
import { ErrorContext } from '../interfaces/async-handler.interface';

// ─── Timeout ────────────────────────────────────────────────────────────────

/**
 * Race a promise against a timeout.
 *
 * @example
 * const data = await withTimeout(fetchUser(id), { timeoutMs: 5000, message: 'Fetch user' });
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: { timeoutMs: number; operation?: string; signal?: AbortSignal },
): Promise<T> {
  const { timeoutMs, operation = 'operation', signal } = options;

  const token = new CancellationToken(operation, signal);
  const timedToken = token.withTimeout(timeoutMs);

  try {
    return await raceWithCancellation(promise, timedToken, operation);
  } catch (err) {
    if (err instanceof Error && err.name === 'CancellationError' && !signal?.aborted) {
      throw new TimeoutError(operation, timeoutMs);
    }
    throw err;
  } finally {
    timedToken.dispose();
    token.dispose();
  }
}

// ─── Promise.all with concurrency & fail-fast ───────────────────────────────

/**
 * Run async tasks in parallel with optional concurrency limit and fail-fast.
 *
 * **When to use Promise.all vs Promise.allSettled:**
 * - `Promise.all` — use when ALL results are needed and a single failure should halt everything.
 * - `Promise.allSettled` — use when partial success is acceptable; inspect each result individually.
 * - `parallelAll` — use when you need concurrency limiting, abort signals, or fail-fast control.
 *
 * @example
 * const results = await parallelAll(ids.map(id => () => fetchUser(id)), { concurrency: 5 });
 */
export async function parallelAll<T>(
  tasks: Array<() => Promise<T>>,
  options: ParallelOptions = {},
): Promise<T[]> {
  const { concurrency, failFast = true, signal, timeoutMs } = options;

  if (tasks.length === 0) return [];

  const token = new CancellationToken('parallelAll', signal);
  if (timeoutMs) token.withTimeout(timeoutMs);

  const results: T[] = new Array(tasks.length);
  const errors: Array<{ index: number; error: Error }> = [];
  let cursor = 0;
  let active = 0;

  return new Promise<T[]>((resolve, reject) => {
    const limit = concurrency ?? tasks.length;

    const runNext = () => {
      while (active < limit && cursor < tasks.length) {
        if (token.isCancelled) break;

        const index = cursor++;
        active++;

        tasks[index]()
          .then((value) => {
            results[index] = value;
            active--;
            if (cursor < tasks.length) {
              runNext();
            } else if (active === 0) {
              token.dispose();
              resolve(results);
            }
          })
          .catch((err: Error) => {
            active--;
            errors.push({ index, error: err });

            if (failFast) {
              token.cancel('fail-fast');
              token.dispose();
              reject(err);
            } else if (cursor < tasks.length) {
              runNext();
            } else if (active === 0) {
              token.dispose();
              if (errors.length) {
                reject(new AggregateError(errors.map((e) => e.error), 'Multiple errors occurred'));
              } else {
                resolve(results);
              }
            }
          });
      }
    };

    token.signal.addEventListener('abort', () => {
      if (!failFast) {
        reject(new Error('parallelAll cancelled'));
      }
    });

    runNext();
  });
}

/**
 * Run tasks in parallel and collect ALL results (fulfilled + rejected).
 * Always resolves; inspect `.status` on each result.
 *
 * @example
 * const results = await parallelSettled(tasks, { concurrency: 10 });
 * const successes = results.filter(r => r.status === 'fulfilled').map(r => r.value!);
 */
export async function parallelSettled<T>(
  tasks: Array<() => Promise<T>>,
  options: Pick<ParallelOptions, 'concurrency' | 'signal' | 'timeoutMs'> = {},
): Promise<SettledResult<T>[]> {
  const { concurrency, signal, timeoutMs } = options;
  const limit = concurrency ?? tasks.length;
  const results: SettledResult<T>[] = [];

  const token = new CancellationToken('parallelSettled', signal);
  if (timeoutMs) token.withTimeout(timeoutMs);

  const chunks: Array<Array<{ index: number; task: () => Promise<T> }>> = [];
  for (let i = 0; i < tasks.length; i += limit) {
    chunks.push(tasks.slice(i, i + limit).map((task, j) => ({ index: i + j, task })));
  }

  for (const chunk of chunks) {
    if (token.isCancelled) break;

    const settled = await Promise.allSettled(chunk.map(({ task }) => task()));
    settled.forEach((outcome, j) => {
      const index = chunk[j].index;
      if (outcome.status === 'fulfilled') {
        results.push({ status: 'fulfilled', value: outcome.value, index });
      } else {
        results.push({ status: 'rejected', reason: outcome.reason as Error, index });
      }
    });
  }

  token.dispose();
  return results;
}

/**
 * Race multiple promises and cancel the rest when the winner resolves.
 */
export async function raceAll<T>(
  tasks: Array<() => Promise<T>>,
  context: Partial<ErrorContext> = {},
): Promise<T> {
  const token = new CancellationToken(`raceAll:${context.operation ?? 'unknown'}`);

  try {
    const wrapped = tasks.map((task) =>
      raceWithCancellation(task(), token, context.operation),
    );
    const result = await Promise.race(wrapped);
    return result;
  } finally {
    token.cancel('race won');
    token.dispose();
  }
}
