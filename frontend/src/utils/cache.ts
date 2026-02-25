const cache = new Map<string, any>();

export const getCached = (key: string) =>
  cache.get(key);

export const setCached = (
  key: string,
  value: any
) => cache.set(key, value);