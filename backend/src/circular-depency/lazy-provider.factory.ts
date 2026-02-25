import { Provider, Type, ModuleRef } from '@nestjs/common';
import { LAZY_PROVIDER_PREFIX } from './constants';

export interface LazyRef<T> {
  getInstance(): T;
}

/**
 * Creates a lazy provider that defers module resolution until first access.
 * This breaks circular initialization cycles.
 *
 * @param token - The original injection token or class
 */
export function createLazyProvider<T>(token: Type<T> | string | symbol): Provider {
  const lazyToken = `${LAZY_PROVIDER_PREFIX}${String(typeof token === 'function' ? token.name : token)}`;

  return {
    provide: lazyToken,
    useFactory: (moduleRef: ModuleRef): LazyRef<T> => {
      let instance: T | null = null;

      return {
        getInstance(): T {
          if (!instance) {
            instance = moduleRef.get<T>(token as Type<T>, { strict: false });
          }
          return instance;
        },
      };
    },
    inject: [ModuleRef],
  };
}

/**
 * Creates multiple lazy providers at once.
 */
export function createLazyProviders(tokens: Array<Type<any> | string | symbol>): Provider[] {
  return tokens.map(createLazyProvider);
}

/**
 * Proxy handler that forwards all property accesses to the lazy instance.
 * Allows lazy refs to be used as if they were the real service.
 */
export function createLazyProxy<T extends object>(lazyRef: LazyRef<T>): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const instance = lazyRef.getInstance();
      const value = (instance as any)[prop];
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      return value;
    },
    set(_target, prop, value) {
      (lazyRef.getInstance() as any)[prop] = value;
      return true;
    },
    has(_target, prop) {
      return prop in (lazyRef.getInstance() as any);
    },
  });
}
