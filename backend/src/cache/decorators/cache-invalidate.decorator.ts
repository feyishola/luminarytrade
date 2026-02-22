import { SetMetadata } from '@nestjs/common';

export const CACHE_INVALIDATE_KEY = 'cache_invalidate';

export interface CacheInvalidateOptions {
  /**
   * Invalidation rule name to execute
   */
  rule?: string;
  
  /**
   * Specific cache keys to invalidate
   */
  keys?: string[] | ((...args: any[]) => string[]);
  
  /**
   * Cache key patterns to invalidate
   */
  patterns?: string[] | ((...args: any[]) => string[]);
  
  /**
   * Cache namespace
   */
  namespace?: string;
  
  /**
   * When to invalidate: 'before' or 'after' method execution
   */
  when?: 'before' | 'after';
}

/**
 * Decorator to invalidate cache after method execution
 * 
 * @example
 * @CacheInvalidate({ rule: 'agent:create' })
 * async create(dto: CreateAgentDto): Promise<Agent> {
 *   // method implementation
 * }
 * 
 * @example
 * @CacheInvalidate({ 
 *   keys: (id: string) => [`agent:${id}`],
 *   patterns: ['agents:*'],
 *   namespace: 'agent'
 * })
 * async update(id: string, dto: UpdateAgentDto): Promise<Agent> {
 *   // method implementation
 * }
 */
export const CacheInvalidate = (options: CacheInvalidateOptions = {}): MethodDecorator => {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_INVALIDATE_KEY, options)(target, propertyKey, descriptor);
    
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const when = options.when || 'after';

    descriptor.value = async function (...args: any[]) {
      const cacheInvalidator = (this as any).cacheInvalidator;
      
      if (!cacheInvalidator) {
        console.warn(`CacheInvalidator not found in ${className}. Skipping invalidation.`);
        return originalMethod.apply(this, args);
      }

      const performInvalidation = async () => {
        // Invalidate by rule
        if (options.rule) {
          await cacheInvalidator.invalidate(options.rule);
        }

        // Invalidate specific keys
        if (options.keys) {
          const keys = typeof options.keys === 'function' 
            ? options.keys(...args) 
            : options.keys;
          
          await cacheInvalidator.invalidateKeys(keys, options.namespace);
        }

        // Invalidate by patterns
        if (options.patterns) {
          const patterns = typeof options.patterns === 'function'
            ? options.patterns(...args)
            : options.patterns;
          
          await Promise.all(
            patterns.map(pattern => 
              cacheInvalidator.invalidatePattern(pattern, options.namespace)
            )
          );
        }
      };

      // Invalidate before method execution
      if (when === 'before') {
        await performInvalidation();
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Invalidate after method execution
      if (when === 'after') {
        await performInvalidation();
      }

      return result;
    };

    return descriptor;
  };
};
