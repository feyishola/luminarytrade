/**
 * useDebounce.ts
 *
 * Custom hook for debouncing values and callbacks.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseDebounceOptions {
  /** Delay in milliseconds */
  delay?: number;
  /** Whether to leading edge trigger */
  leading?: boolean;
  /** Whether to trailing edge trigger */
  trailing?: boolean;
}

export interface UseDebounceReturn<T> {
  /** Debounced value */
  debouncedValue: T;
  /** Whether debouncing is pending */
  isPending: boolean;
  /** Cancel pending debounce */
  cancel: () => void;
  /** Flush pending debounce immediately */
  flush: () => void;
}

// ─── Hook: useDebounce ────────────────────────────────────────────────────────

export function useDebounce<T>(
  value: T,
  delay: number = 500
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ─── Hook: useDebounceCallback ────────────────────────────────────────────────

export function useDebounceCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500,
  options: Omit<UseDebounceOptions, "delay"> = {}
): [(...args: Parameters<T>) => void, () => void] {
  const { leading = false, trailing = true } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const isLeadingCalledRef = useRef(false);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      lastArgsRef.current = args;

      // Leading edge
      if (leading && !timeoutRef.current && !isLeadingCalledRef.current) {
        callbackRef.current(...args);
        isLeadingCalledRef.current = true;
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        if (trailing && lastArgsRef.current) {
          callbackRef.current(...lastArgsRef.current);
        }
        timeoutRef.current = null;
        isLeadingCalledRef.current = false;
        lastArgsRef.current = null;
      }, delay);
    },
    [delay, leading, trailing]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    lastArgsRef.current = null;
    isLeadingCalledRef.current = false;
  }, []);

  return [debouncedFn, cancel];
}

// ─── Hook: useDebounceState ───────────────────────────────────────────────────

export function useDebounceState<T>(
  initialValue: T,
  delay: number = 500,
  options: UseDebounceOptions = {}
): [T, T, (value: T | ((prev: T) => T)) => void, UseDebounceReturn<T>] {
  const [value, setValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { leading = false, trailing = true } = options;

  const setDebouncedState = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const resolvedValue =
        newValue instanceof Function ? newValue(value) : newValue;

      setValue(resolvedValue);
      setIsPending(true);

      // Leading edge
      if (leading && !timeoutRef.current) {
        setDebouncedValue(resolvedValue);
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        if (trailing) {
          setDebouncedValue(resolvedValue);
        }
        setIsPending(false);
        timeoutRef.current = null;
      }, delay);
    },
    [delay, leading, trailing, value]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPending(false);
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setDebouncedValue(value);
    setIsPending(false);
  }, [value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [
    value,
    debouncedValue,
    setDebouncedState,
    {
      debouncedValue,
      isPending,
      cancel,
      flush,
    },
  ];
}

// ─── Hook: useThrottle ────────────────────────────────────────────────────────

export function useThrottle<T>(value: T, limit: number = 500): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const remaining = limit - (now - lastRan.current);

    if (remaining <= 0) {
      setThrottledValue(value);
      lastRan.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [value, limit]);

  return throttledValue;
}

export default useDebounce;
