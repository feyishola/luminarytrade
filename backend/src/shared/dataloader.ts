// shared/dataloader.ts - Reusable DataLoader factory for batch loading

import DataLoader from "dataloader";

export type BatchLoadFn<K, V> = (keys: readonly K[]) => Promise<(V | Error)[]>;

export interface DataLoaderOptions {
  maxBatchSize?: number;
  cacheKeyFn?: (key: unknown) => string;
  cacheTTL?: number;
}

/**
 * Creates a DataLoader with optional TTL-based cache invalidation.
 */
export function createLoader<K, V>(
  batchFn: BatchLoadFn<K, V>,
  options: DataLoaderOptions = {},
): DataLoader<K, V> {
  const loader = new DataLoader<K, V>(batchFn, {
    maxBatchSize: options.maxBatchSize ?? 100,
    cacheKeyFn: options.cacheKeyFn ?? ((key) => String(key)),
  });

  // TTL cache invalidation
  if (options.cacheTTL) {
    const originalLoad = loader.load.bind(loader);
    loader.load = (key: K) => {
      setTimeout(() => loader.clear(key), options.cacheTTL);
      return originalLoad(key);
    };
  }

  return loader;
}

/**
 * Helper: reorder batch results to match key order (required by DataLoader).
 */
export function reorderByKeys<K, V>(
  keys: readonly K[],
  items: V[],
  getKey: (item: V) => K,
): (V | Error)[] {
  const map = new Map(items.map((item) => [getKey(item), item]));
  return keys.map((k) => map.get(k) ?? new Error(`No result for key: ${k}`));
}

/**
 * Per-request loader registry — create once per request context.
 */
export class LoaderRegistry {
  private loaders = new Map<string, DataLoader<unknown, unknown>>();

  getOrCreate<K, V>(
    name: string,
    batchFn: BatchLoadFn<K, V>,
    options?: DataLoaderOptions,
  ): DataLoader<K, V> {
    if (!this.loaders.has(name)) {
      this.loaders.set(
        name,
        createLoader(batchFn, options) as DataLoader<unknown, unknown>,
      );
    }
    return this.loaders.get(name) as DataLoader<K, V>;
  }

  clearAll(): void {
    this.loaders.forEach((l) => l.clearAll());
  }
}
