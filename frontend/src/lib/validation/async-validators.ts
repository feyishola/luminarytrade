import { Validator, ValidationResult, ValidationErrorCode } from './types';

/**
 * Asynchronous email uniqueness validator
 */
export const uniqueEmail = (
  checkFn: (email: string) => Promise<boolean>,
  message?: string,
): Validator<string> => {
  return async (value, _, fieldName) => {
    if (!value) return { valid: true };
    
    try {
      const isUnique = await checkFn(value);
      return {
        valid: isUnique,
        code: ValidationErrorCode.CUSTOM,
        message: message || 'Email is already in use',
      };
    } catch (error) {
      return {
        valid: false,
        code: ValidationErrorCode.CUSTOM,
        message: 'Error checking email availability',
      };
    }
  };
};

/**
 * Asynchronous Stellar address existence validator
 */
export const existingStellarAddress = (
  checkFn: (address: string) => Promise<boolean>,
  message?: string,
): Validator<string> => {
  return async (value, _, fieldName) => {
    if (!value) return { valid: true };
    
    try {
      const exists = await checkFn(value);
      return {
        valid: exists,
        code: ValidationErrorCode.CUSTOM,
        message: message || 'Stellar address does not exist',
      };
    } catch (error) {
      return {
        valid: false,
        code: ValidationErrorCode.CUSTOM,
        message: 'Error checking address existence',
      };
    }
  };
};

/**
 * Asynchronous asset code validator
 */
export const validAssetCode = (
  checkFn: (code: string) => Promise<boolean>,
  message?: string,
): Validator<string> => {
  return async (value, _, fieldName) => {
    if (!value) return { valid: true };
    
    try {
      const isValid = await checkFn(value);
      return {
        valid: isValid,
        code: ValidationErrorCode.CUSTOM,
        message: message || 'Invalid asset code',
      };
    } catch (error) {
      return {
        valid: false,
        code: ValidationErrorCode.CUSTOM,
        message: 'Error validating asset code',
      };
    }
  };
};

/**
 * Rate-limited validator (to prevent spamming API calls)
 */
export const rateLimited = <T>(
  validator: Validator<T>,
  delay: number = 300,
): Validator<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: Promise<ValidationResult> | null = null;

  return (value: T, formData?: Record<string, any>, fieldName?: string): Promise<ValidationResult> => {
    // Cancel previous timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Cancel previous promise if exists
    if (pendingPromise) {
      // We can't actually cancel a promise, but we can ignore its result
      // by returning a new promise instead
    }

    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await validator(value, formData, fieldName);
          resolve(result);
        } catch (error) {
          resolve({
            valid: false,
            code: ValidationErrorCode.CUSTOM,
            message: 'Validation error occurred',
          });
        }
      }, delay);
    });
  };
};

/**
 * Debounced validator
 */
export const debounced = <T>(
  validator: Validator<T>,
  delay: number = 300,
): Validator<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (value: T, formData?: Record<string, any>, fieldName?: string): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        try {
          const result = await validator(value, formData, fieldName);
          resolve(result);
        } catch (error) {
          resolve({
            valid: false,
            code: ValidationErrorCode.CUSTOM,
            message: 'Validation error occurred',
          });
        }
      }, delay);
    });
  };
};

/**
 * Conditional async validator
 */
export const conditionalAsync = <T>(
  condition: (value: T, formData?: Record<string, any>) => boolean,
  validator: Validator<T>,
): Validator<T> => {
  return async (value, formData, fieldName) => {
    if (!condition(value, formData)) {
      return { valid: true };
    }
    return validator(value, formData, fieldName);
  };
};

/**
 * Async validator with caching
 */
export class CachedAsyncValidator<T> {
  private cache: Map<string, { result: ValidationResult; timestamp: number; ttl: number }> = new Map();

  constructor(private validator: Validator<T>, private ttl: number = 5 * 60 * 1000) {} // 5 minutes default TTL

  async validate(value: T, formData?: Record<string, any>, fieldName?: string): Promise<ValidationResult> {
    // Create cache key based on value and field name
    const cacheKey = `${String(fieldName)}:${JSON.stringify(value)}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < cached.ttl) {
        return cached.result;
      } else {
        // Remove expired cache entry
        this.cache.delete(cacheKey);
      }
    }

    const result = await this.validator(value, formData, fieldName);

    // Cache the result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl: this.ttl,
    });

    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}

/**
 * Create a cached async validator instance
 */
export const cachedAsync = <T>(validator: Validator<T>, ttl: number = 5 * 60 * 1000) => {
  return new CachedAsyncValidator(validator, ttl);
};