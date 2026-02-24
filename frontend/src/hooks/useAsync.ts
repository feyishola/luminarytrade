/**
 * useAsync.ts
 *
 * Custom hook for managing async operations with loading, error, and success states.
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AsyncStatus = "idle" | "pending" | "success" | "error";

export interface UseAsyncOptions<T, E = Error> {
  /** Execute immediately */
  immediate?: boolean;
  /** Initial data */
  initialData?: T;
  /** On success callback */
  onSuccess?: (data: T) => void;
  /** On error callback */
  onError?: (error: E) => void;
  /** On finally callback */
  onFinally?: () => void;
}

export interface UseAsyncReturn<T, E = Error, Args extends any[] = any[]> {
  /** Execute the async function */
  execute: (...args: Args) => Promise<T>;
  /** Current status */
  status: AsyncStatus;
  /** Whether operation is pending */
  isPending: boolean;
  /** Whether operation succeeded */
  isSuccess: boolean;
  /** Whether operation failed */
  isError: boolean;
  /** Whether operation is idle */
  isIdle: boolean;
  /** Result data */
  data: T | undefined;
  /** Error if any */
  error: E | null;
  /** Reset state */
  reset: () => void;
  /** Set data manually */
  setData: (data: T | ((prev: T | undefined) => T)) => void;
  /** Set error manually */
  setError: (error: E) => void;
}

// ─── Hook: useAsync ───────────────────────────────────────────────────────────

export function useAsync<T, E = Error, Args extends any[] = any[]>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T, E> = {}
): UseAsyncReturn<T, E, Args> {
  const {
    immediate = false,
    initialData,
    onSuccess,
    onError,
    onFinally,
  } = options;

  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [data, setDataState] = useState<T | undefined>(initialData);
  const [error, setErrorState] = useState<E | null>(null);

  const isMountedRef = useRef(true);
  const asyncFunctionRef = useRef(asyncFunction);

  // Update function ref when it changes
  useEffect(() => {
    asyncFunctionRef.current = asyncFunction;
  }, [asyncFunction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: Args): Promise<T> => {
      setStatus("pending");
      setErrorState(null);

      try {
        const result = await asyncFunctionRef.current(...args);

        if (isMountedRef.current) {
          setDataState(result);
          setStatus("success");
          onSuccess?.(result);
        }

        return result;
      } catch (err) {
        const error = (err instanceof Error ? err : new Error(String(err))) as E;

        if (isMountedRef.current) {
          setErrorState(error);
          setStatus("error");
          onError?.(error);
        }

        throw error;
      } finally {
        if (isMountedRef.current) {
          onFinally?.();
        }
      }
    },
    [onSuccess, onError, onFinally]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setDataState(initialData);
    setErrorState(null);
  }, [initialData]);

  const setData = useCallback((newData: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) =>
      newData instanceof Function ? newData(prev) : newData
    );
  }, []);

  const setError = useCallback((newError: E) => {
    setErrorState(newError);
    setStatus("error");
  }, []);

  // Execute immediately if specified
  useEffect(() => {
    if (immediate) {
      void execute(...([] as unknown as Args));
    }
  }, [immediate, execute]);

  return {
    execute,
    status,
    isPending: status === "pending",
    isSuccess: status === "success",
    isError: status === "error",
    isIdle: status === "idle",
    data,
    error,
    reset,
    setData,
    setError,
  };
}

// ─── Hook: useAsyncFn ─────────────────────────────────────────────────────────

export function useAsyncFn<T, E = Error, Args extends any[] = any[]>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: Omit<UseAsyncOptions<T, E>, "immediate"> = {}
): UseAsyncReturn<T, E, Args> {
  return useAsync(asyncFunction, { ...options, immediate: false });
}

// ─── Hook: useAsyncRetry ──────────────────────────────────────────────────────

export interface UseAsyncRetryOptions<T, E = Error>
  extends UseAsyncOptions<T, E> {
  /** Number of retries */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Should retry predicate */
  shouldRetry?: (error: E, attempt: number) => boolean;
}

export function useAsyncRetry<T, E = Error, Args extends any[] = any[]>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncRetryOptions<T, E> = {}
): UseAsyncReturn<T, E, Args> & { retry: () => void } {
  const {
    retryCount = 3,
    retryDelay = 1000,
    shouldRetry = () => true,
    ...asyncOptions
  } = options;

  const [retryAttempt, setRetryAttempt] = useState(0);
  const lastArgsRef = useRef<Args | null>(null);

  const wrappedFunction = useCallback(
    async (...args: Args): Promise<T> => {
      lastArgsRef.current = args;

      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          const result = await asyncFunction(...args);
          setRetryAttempt(0);
          return result;
        } catch (err) {
          const error = err as E;

          if (attempt === retryCount || !shouldRetry(error, attempt)) {
            throw error;
          }

          setRetryAttempt(attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }

      throw new Error("Retry failed");
    },
    [asyncFunction, retryCount, retryDelay, shouldRetry]
  );

  const asyncResult = useAsync(wrappedFunction, asyncOptions);

  const retry = useCallback(() => {
    if (lastArgsRef.current) {
      asyncResult.execute(...lastArgsRef.current);
    }
  }, [asyncResult]);

  return {
    ...asyncResult,
    retry,
  };
}

// ─── Hook: usePromise ─────────────────────────────────────────────────────────

export function usePromise<T>(promise: Promise<T> | null | undefined) {
  const [state, setState] = useState<{
    data: T | undefined;
    error: Error | null;
    isPending: boolean;
  }>({
    data: undefined,
    error: null,
    isPending: !!promise,
  });

  useEffect(() => {
    if (!promise) {
      setState({ data: undefined, error: null, isPending: false });
      return;
    }

    let isCancelled = false;

    setState((prev) => ({ ...prev, isPending: true }));

    promise
      .then((data) => {
        if (!isCancelled) {
          setState({ data, error: null, isPending: false });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setState({
            data: undefined,
            error: error instanceof Error ? error : new Error(String(error)),
            isPending: false,
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [promise]);

  return state;
}

export default useAsync;
