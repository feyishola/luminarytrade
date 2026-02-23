/**
 * useLocalStorage.ts
 *
 * Custom hook for persistent state management using localStorage.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StorageType = "localStorage" | "sessionStorage";

export interface UseLocalStorageOptions<T> {
  /** Storage key */
  key: string;
  /** Default value */
  defaultValue: T;
  /** Storage type */
  storage?: StorageType;
  /** Serialize function */
  serialize?: (value: T) => string;
  /** Deserialize function */
  deserialize?: (value: string) => T;
  /** Sync across tabs */
  sync?: boolean;
}

export interface UseLocalStorageReturn<T> {
  /** Stored value */
  value: T;
  /** Set value */
  setValue: (value: T | ((prev: T) => T)) => void;
  /** Remove from storage */
  remove: () => void;
  /** Check if key exists */
  exists: boolean;
}

// ─── Storage Utilities ────────────────────────────────────────────────────────

function getStorage(storageType: StorageType): Storage {
  return storageType === "localStorage" ? localStorage : sessionStorage;
}

function getStoredValue<T>(
  key: string,
  defaultValue: T,
  storageType: StorageType,
  deserialize: (value: string) => T
): T {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const storage = getStorage(storageType);
    const item = storage.getItem(key);
    return item ? deserialize(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading ${storageType} key "${key}":`, error);
    return defaultValue;
  }
}

function setStoredValue<T>(
  key: string,
  value: T,
  storageType: StorageType,
  serialize: (value: T) => string
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storage = getStorage(storageType);
    storage.setItem(key, serialize(value));
  } catch (error) {
    console.warn(`Error setting ${storageType} key "${key}":`, error);
  }
}

function removeStoredValue(key: string, storageType: StorageType): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storage = getStorage(storageType);
    storage.removeItem(key);
  } catch (error) {
    console.warn(`Error removing ${storageType} key "${key}":`, error);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocalStorage<T>(options: UseLocalStorageOptions<T>): UseLocalStorageReturn<T> {
  const {
    key,
    defaultValue,
    storage: storageType = "localStorage",
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    sync = true,
  } = options;

  // ─── State ──────────────────────────────────────────────────────────────────

  const [value, setValueState] = useState<T>(() =>
    getStoredValue(key, defaultValue, storageType, deserialize)
  );

  const [exists, setExists] = useState(() => {
    if (typeof window === "undefined") return false;
    const storage = getStorage(storageType);
    return storage.getItem(key) !== null;
  });

  const keyRef = useRef(key);

  // ─── Set Value ──────────────────────────────────────────────────────────────

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const valueToStore = newValue instanceof Function ? newValue(prev) : newValue;
        setStoredValue(keyRef.current, valueToStore, storageType, serialize);
        setExists(true);
        return valueToStore;
      });
    },
    [storageType, serialize]
  );

  // ─── Remove ─────────────────────────────────────────────────────────────────

  const remove = useCallback(() => {
    removeStoredValue(keyRef.current, storageType);
    setValueState(defaultValue);
    setExists(false);
  }, [storageType, defaultValue]);

  // ─── Sync Across Tabs ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!sync || typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === keyRef.current && e.storageArea === getStorage(storageType)) {
        if (e.newValue === null) {
          setValueState(defaultValue);
          setExists(false);
        } else {
          try {
            setValueState(deserialize(e.newValue));
            setExists(true);
          } catch {
            console.warn(`Failed to deserialize storage value for key "${keyRef.current}"`);
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [sync, storageType, deserialize, defaultValue]);

  // ─── Update Key ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (key !== keyRef.current) {
      keyRef.current = key;
      const stored = getStoredValue(key, defaultValue, storageType, deserialize);
      setValueState(stored);
      setExists(getStorage(storageType).getItem(key) !== null);
    }
  }, [key, defaultValue, storageType, deserialize]);

  return {
    value,
    setValue,
    remove,
    exists,
  };
}

// ─── Specialized Hooks ────────────────────────────────────────────────────────

export function useSessionStorage<T>(
  key: string,
  defaultValue: T,
  options?: Omit<UseLocalStorageOptions<T>, "key" | "defaultValue" | "storage">
) {
  return useLocalStorage({
    key,
    defaultValue,
    storage: "sessionStorage",
    ...options,
  });
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export const storage = {
  get: <T,>(key: string, defaultValue: T, storageType: StorageType = "localStorage"): T => {
    return getStoredValue(key, defaultValue, storageType, JSON.parse);
  },

  set: <T,>(key: string, value: T, storageType: StorageType = "localStorage"): void => {
    setStoredValue(key, value, storageType, JSON.stringify);
  },

  remove: (key: string, storageType: StorageType = "localStorage"): void => {
    removeStoredValue(key, storageType);
  },

  clear: (storageType: StorageType = "localStorage"): void => {
    if (typeof window === "undefined") return;
    getStorage(storageType).clear();
  },

  keys: (storageType: StorageType = "localStorage"): string[] => {
    if (typeof window === "undefined") return [];
    const storage = getStorage(storageType);
    return Object.keys(storage);
  },

  size: (storageType: StorageType = "localStorage"): number => {
    if (typeof window === "undefined") return 0;
    return getStorage(storageType).length;
  },
};

export default useLocalStorage;
