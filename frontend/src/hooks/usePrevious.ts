/**
 * usePrevious.ts
 *
 * Custom hook for tracking previous values.
 */

import React, { useRef, useEffect, DependencyList, EffectCallback } from "react";

// ─── Hook: usePrevious ────────────────────────────────────────────────────────

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

// ─── Hook: usePreviousDistinct ────────────────────────────────────────────────

export function usePreviousDistinct<T>(
  value: T,
  compare: (a: T, b: T) => boolean = (a, b) => a === b
): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  const prevValue = ref.current;

  useEffect(() => {
    if (prevValue === undefined || !compare(prevValue, value)) {
      ref.current = value;
    }
  }, [value, compare, prevValue]);

  return prevValue;
}

// ─── Hook: useUpdatedRef ──────────────────────────────────────────────────────

export function useUpdatedRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

// ─── Hook: useFirstMount ──────────────────────────────────────────────────────

export function useFirstMount(): boolean {
  const isFirst = useRef(true);

  useEffect(() => {
    isFirst.current = false;
  }, []);

  return isFirst.current;
}

// ─── Hook: useUpdateEffect ────────────────────────────────────────────────────

export function useUpdateEffect(effect: EffectCallback, deps?: DependencyList) {
  const isFirstMount = useFirstMount();

  useEffect(() => {
    if (!isFirstMount) {
      return effect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ─── Hook: useLatest ──────────────────────────────────────────────────────────

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

// ─── Hook: useCompare ─────────────────────────────────────────────────────────

export function useCompare<T>(
  value: T,
  compare: (a: T, b: T) => boolean = (a, b) => a === b
): boolean {
  const prevRef = useRef<T | undefined>(undefined);
  const isDifferent = prevRef.current === undefined || !compare(prevRef.current, value);

  useEffect(() => {
    prevRef.current = value;
  });

  return isDifferent;
}

export default usePrevious;
