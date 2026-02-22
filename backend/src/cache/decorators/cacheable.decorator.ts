import { SetMetadata } from '@nestjs/common';

export const CACHEABLE_KEY = 'cacheable';

export interface CacheableOptions {
  /**
   * Cache key or function to generate cache key
   */
  key?: string | ((...args: any[]) => string);
  
  /**
   * Time to live in seconds
   */
  ttl?: number;
  
  /**
   * Cache namespace
   */
  namespace?: string;
  
  /**
   * Condition function to determine if result should be cached
   */
  condition?: (...args: any[]) => boolean;
}

/**
 * Decorator to mark a method as cacheable
 * 
 * @example
 * @Cacheable({ key: 'top-performers', ttl: 300, namespace: 'agent' })
 * async getTopPerformers(limit: number): Promise<Agent[]> {
 *   // method implementation
 * }
 * 
 * @example
 * @Cacheable({ 
 *   key: (id: string) => `agent:${id}`,
 *   ttl: 600,
 *   condition: (id: string) => id !== 'skip-cache'
 * })
 * async findOne(id: string): Promise<Agent> {
 *   // method implementation
 * }
 */
export const Cacheable = (options: CacheableOptions = {}): MethodDecorator => {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHEABLE_KEY, options)(target, propertyKey, descriptor);
    
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = String(propertyKey);

    descriptor.value = async function (...args: any[]) {
      const cacheManager = (this as any).cacheManager;
      
      if (!cacheManager) {
        console.warn(`CacheManager not found in ${className}. Skipping cache.`);
        return originalMethod.apply(this, args);
      }

      // Check condition
      if (options.condition && !options.condition(...args)) {
        return originalMethod.apply(this, args);
      }

      // Generate cache key
      let cacheKey: string;
      if (typeof options.key === 'function') {
        cacheKey = options.key(...args);
      } else if (options.key) {
        cacheKey = options.key;
      } else {
        // Default key: className:methodName:args
        const argsKey = args.length > 0 ? `:${JSON.stringify(args)}` : '';
        cacheKey = `${className}:${methodName}${argsKey}`;
      }

      // Try to get from cache
      const cached = await cacheManager.get(cacheKey, {
        namespace: options.namespace,
      });

      if (cached !== undefined && cached !== null) {
        return cached;
      }

      // Execute method and cache result
      const result = await originalMethod.apply(this, args);
      
      await cacheManager.set(cacheKey, result, {
        ttl: options.ttl,
        namespace: options.namespace,
      });

      return result;
    };

    return descriptor;
  };
};
