import { GeneratorError } from './error-context.util';
import { CancellationToken } from './cancellation.util';
import { StreamOptions, StreamResult } from '../interfaces/async-handler.interface';
import { ErrorContext } from '../interfaces/async-handler.interface';

/**
 * Transform a raw async iterable into a controlled stream with:
 * - Per-item error handling (continue or abort)
 * - Cancellation support
 * - Optional timeout per item
 * - Cleanup on error or completion
 *
 * @example
 * const { items, errors } = await collectStream(fetchRecordsGenerator(), {
 *   onItem: (item) => process(item),
 *   signal: controller.signal,
 * });
 */
export async function collectStream<T>(
  source: AsyncIterable<T> | (() => AsyncGenerator<T>),
  options: StreamOptions<T> = {},
  context: Partial<ErrorContext> = {},
): Promise<StreamResult<T>> {
  const { onItem, onComplete, onError, signal, timeoutMs } = options;
  const token = new CancellationToken(context.operation ?? 'stream', signal);
  if (timeoutMs) token.withTimeout(timeoutMs);

  const items: T[] = [];
  const errors: Array<{ index: number; error: Error }> = [];
  let index = 0;
  let cancelled = false;
  let timedOut = false;

  const iterable = typeof source === 'function' ? source() : source;

  try {
    for await (const item of iterable) {
      if (token.isCancelled) {
        cancelled = true;
        timedOut = !signal?.aborted && (timeoutMs !== undefined);
        break;
      }

      try {
        await onItem?.(item, index);
        items.push(item);
      } catch (itemError) {
        const wrapped =
          itemError instanceof Error ? itemError : new Error(String(itemError));
        errors.push({ index, error: wrapped });

        const shouldContinue = onError ? await onError(wrapped, index) : false;
        if (!shouldContinue) {
          throw new GeneratorError(
            context.operation ?? 'stream',
            wrapped,
            { ...context, metadata: { failedIndex: index } },
          );
        }
      }

      index++;
    }
  } catch (err) {
    if (!cancelled) {
      const wrapped =
        err instanceof GeneratorError
          ? err
          : new GeneratorError(context.operation ?? 'stream', err instanceof Error ? err : new Error(String(err)), context);

      token.dispose();

      // If no recovery via onError, propagate
      const alreadyHandled = errors.some((e) => e.index === index);
      if (!alreadyHandled) throw wrapped;
    }
  } finally {
    token.dispose();
  }

  await onComplete?.(items.length);

  return { items, totalItems: items.length, errors, cancelled, timedOut };
}

/**
 * Async generator that batches items from a source generator.
 *
 * @example
 * for await (const batch of batchStream(source, 100)) {
 *   await bulkInsert(batch);
 * }
 */
export async function* batchStream<T>(
  source: AsyncIterable<T>,
  batchSize: number,
  signal?: AbortSignal,
): AsyncGenerator<T[]> {
  let batch: T[] = [];
  const token = new CancellationToken('batchStream', signal);

  try {
    for await (const item of source) {
      token.throwIfCancelled();
      batch.push(item);
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length > 0) yield batch;
  } finally {
    token.dispose();
  }
}

/**
 * Map over an async iterable with concurrency control.
 *
 * @example
 * const processed = mapStream(fileStream, async (file) => parse(file), { concurrency: 4 });
 * for await (const result of processed) { ... }
 */
export async function* mapStream<T, R>(
  source: AsyncIterable<T>,
  mapper: (item: T, index: number) => Promise<R>,
  options: { concurrency?: number; signal?: AbortSignal } = {},
): AsyncGenerator<R> {
  const { concurrency = 1, signal } = options;
  const token = new CancellationToken('mapStream', signal);
  const buffer: Promise<R>[] = [];
  let index = 0;

  try {
    for await (const item of source) {
      token.throwIfCancelled();

      buffer.push(mapper(item, index++));

      if (buffer.length >= concurrency) {
        yield await buffer.shift()!;
      }
    }

    // Drain remaining
    while (buffer.length > 0) {
      token.throwIfCancelled();
      yield await buffer.shift()!;
    }
  } finally {
    token.dispose();
  }
}

/**
 * Filter an async iterable with an async predicate.
 */
export async function* filterStream<T>(
  source: AsyncIterable<T>,
  predicate: (item: T) => boolean | Promise<boolean>,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  const token = new CancellationToken('filterStream', signal);
  try {
    for await (const item of source) {
      token.throwIfCancelled();
      if (await predicate(item)) yield item;
    }
  } finally {
    token.dispose();
  }
}

/**
 * Create an async generator from a paginated API.
 *
 * @example
 * for await (const user of paginatedGenerator(
 *   (cursor) => fetchUsers({ cursor, limit: 100 }),
 *   (page) => page.nextCursor,
 * )) { ... }
 */
export async function* paginatedGenerator<TPage, TItem>(
  fetchPage: (cursor?: string) => Promise<TPage>,
  getNextCursor: (page: TPage) => string | null | undefined,
  getItems: (page: TPage) => TItem[],
  signal?: AbortSignal,
): AsyncGenerator<TItem> {
  let cursor: string | undefined;
  const token = new CancellationToken('paginatedGenerator', signal);

  try {
    do {
      token.throwIfCancelled();
      const page = await fetchPage(cursor);
      const items = getItems(page);
      for (const item of items) {
        token.throwIfCancelled();
        yield item;
      }
      cursor = getNextCursor(page) ?? undefined;
    } while (cursor);
  } finally {
    token.dispose();
  }
}
