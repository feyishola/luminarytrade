/**
 * useFetch.ts
 *
 * Custom hook for data fetching with caching, error handling, and composition support.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface FetchOptions extends Omit<RequestInit, "cache"> {
  /** Base URL */
  baseURL?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Whether to use cache */
  cache?: boolean;
  /** Cache TTL in ms */
  cacheTTL?: number;
  /** Retry count on failure */
  retry?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Transform response data */
  transform?: (data: any) => any;
}

export interface UseFetchOptions<T = any> extends FetchOptions {
  /** Initial data */
  initialData?: T;
  /** Execute fetch immediately */
  immediate?: boolean;
  /** URL or path */
  url?: string;
  /** Dependencies for refetching */
  deps?: any[];
}

export interface UseFetchReturn<T = any> {
  /** Fetched data */
  data: T | undefined;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Execute fetch */
  execute: (overrideOptions?: Partial<FetchOptions> & { url?: string }) => Promise<T>;
  /** Refetch data */
  refetch: () => Promise<T>;
  /** Cancel request */
  cancel: () => void;
  /** Update data locally */
  setData: (data: T | ((prev: T | undefined) => T)) => void;
  /** Clear error */
  clearError: () => void;
  /** Whether request was successful */
  isSuccess: boolean;
  /** Whether request failed */
  isError: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ─── Cache Implementation ─────────────────────────────────────────────────────

class FetchCache {
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + (ttl || 60000),
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const fetchCache = new FetchCache();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFetch<T = any>(options: UseFetchOptions<T> = {}): UseFetchReturn<T> {
  const {
    initialData,
    immediate = true,
    url: initialUrl,
    deps = [],
    cache = false,
    cacheTTL = 60000,
    timeout = 30000,
    retry = 0,
    retryDelay = 1000,
    transform,
    ...fetchOptions
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const urlRef = useRef(initialUrl);

  // ─── Execute Function ───────────────────────────────────────────────────────

  const execute = useCallback(
    async (overrideOptions: Partial<FetchOptions> & { url?: string } = {}): Promise<T> => {
      const {
        url: overrideUrl,
        cache: overrideCache,
        cacheTTL: overrideCacheTTL,
        timeout: overrideTimeout,
        retry: overrideRetry,
        retryDelay: overrideRetryDelay,
        transform: overrideTransform,
        ...overrideFetchOptions
      } = overrideOptions;

      const url = overrideUrl || urlRef.current;
      if (!url) {
        throw new Error("URL is required");
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const useCache = overrideCache ?? cache;
      const ttl = overrideCacheTTL ?? cacheTTL;
      const cacheKey = `${fetchOptions.method || "GET"}-${url}`;

      // Check cache
      if (useCache && fetchCache.has(cacheKey)) {
        const cachedData = fetchCache.get<T>(cacheKey);
        setData(cachedData);
        setIsSuccess(true);
        setIsError(false);
        return cachedData!;
      }

      setLoading(true);
      setError(null);
      setIsSuccess(false);
      setIsError(false);

      const baseURL = fetchOptions.baseURL || "";
      const fullUrl = url.startsWith("http") ? url : `${baseURL}${url}`;

      const attemptFetch = async (attempt: number): Promise<T> => {
        try {
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, overrideTimeout ?? timeout);

          const response = await fetch(fullUrl, {
            ...fetchOptions,
            ...overrideFetchOptions,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          const transformed = (overrideTransform || transform)
            ? (overrideTransform || transform)!(result)
            : result;

          // Cache result
          if (useCache) {
            fetchCache.set(cacheKey, transformed, ttl);
          }

          setData(transformed);
          setIsSuccess(true);
          return transformed;
        } catch (err) {
          const currentRetry = overrideRetry ?? retry;
          const currentRetryDelay = overrideRetryDelay ?? retryDelay;

          if (attempt < currentRetry && err instanceof Error && err.name !== "AbortError") {
            await new Promise((resolve) => setTimeout(resolve, currentRetryDelay * attempt));
            return attemptFetch(attempt + 1);
          }

          throw err;
        }
      };

      try {
        const result = await attemptFetch(0);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsError(true);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [cache, cacheTTL, timeout, retry, retryDelay, transform, fetchOptions]
  );

  // ─── Refetch ────────────────────────────────────────────────────────────────

  const refetch = useCallback(async (): Promise<T> => {
    if (urlRef.current) {
      fetchCache.invalidate(`${fetchOptions.method || "GET"}-${urlRef.current}`);
    }
    return execute();
  }, [execute, fetchOptions.method]);

  // ─── Cancel ─────────────────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // ─── Set Data ───────────────────────────────────────────────────────────────

  const setDataCallback = useCallback((newData: T | ((prev: T | undefined) => T)) => {
    setData((prev) => (typeof newData === "function" ? (newData as Function)(prev) : newData));
  }, []);

  // ─── Clear Error ────────────────────────────────────────────────────────────

  const clearError = useCallback(() => {
    setError(null);
    setIsError(false);
  }, []);

  // ─── Effect ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (immediate && initialUrl) {
      execute({ url: initialUrl });
    }

    return () => {
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    loading,
    error,
    execute,
    refetch,
    cancel,
    setData: setDataCallback,
    clearError,
    isSuccess,
    isError,
  };
}

// ─── Helper Hooks ─────────────────────────────────────────────────────────────

export function useGet<T = any>(url: string, options: Omit<UseFetchOptions<T>, "url" | "immediate"> = {}) {
  return useFetch<T>({ ...options, url, immediate: true });
}

export function usePost<T = any>(url: string, options: Omit<UseFetchOptions<T>, "url" | "method"> = {}) {
  return useFetch<T>({ ...options, url, method: "POST" });
}

export function usePut<T = any>(url: string, options: Omit<UseFetchOptions<T>, "url" | "method"> = {}) {
  return useFetch<T>({ ...options, url, method: "PUT" });
}

export function useDelete<T = any>(url: string, options: Omit<UseFetchOptions<T>, "url" | "method"> = {}) {
  return useFetch<T>({ ...options, url, method: "DELETE" });
}

export default useFetch;
