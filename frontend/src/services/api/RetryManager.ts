import { ApiError } from './ApiError';
import { IRetryConfig } from './types';

export class RetryManager {
  private static readonly DEFAULT_CONFIG: IRetryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000
  };

  public static async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    config: Partial<IRetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    let lastError: any;
    
    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attempt === finalConfig.maxRetries) {
          break;
        }
        
        const apiError = error instanceof ApiError ? error : ApiError.fromHttpError(error);
        
        if (!this.shouldRetry(apiError, finalConfig)) {
          break;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, finalConfig);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  private static shouldRetry(error: ApiError, config: IRetryConfig): boolean {
    // Use custom retry condition if provided
    if (config.retryCondition) {
      return config.retryCondition(error);
    }
    
    // Default retry logic
    return error.shouldRetry();
  }

  private static calculateDelay(attempt: number, config: IRetryConfig): number {
    // Exponential backoff with jitter
    const baseDelay = config.retryDelay * Math.pow(config.backoffMultiplier!, attempt);
    const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
    const delay = baseDelay + jitter;
    
    // Cap at max delay
    return Math.min(delay, config.maxDelay!);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static createRetryCondition(statusCodes: number[]): (error: ApiError) => boolean {
    return (error: ApiError) => {
      return error.status ? statusCodes.includes(error.status) : false;
    };
  }

  public static createNetworkRetryCondition(): (error: ApiError) => boolean {
    return (error: ApiError) => {
      return error.isNetworkError() || error.code === 'TIMEOUT_ERROR';
    };
  }

  public static createServerErrorRetryCondition(): (error: ApiError) => boolean {
    return (error: ApiError) => {
      return error.isServerError();
    };
  }
}
