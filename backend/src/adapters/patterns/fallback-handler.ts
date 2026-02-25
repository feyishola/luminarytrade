import { Logger } from '@nestjs/common';

/**
 * Fallback/Failover Pattern
 * Provides fallback adapters when primary adapter fails.
 */
export class FallbackHandler<T> {
  private readonly logger: Logger;

  constructor(private readonly name: string) {
    this.logger = new Logger(`FallbackHandler-${name}`);
  }

  /**
   * Execute operation with fallback chain
   * @param adapters Array of adapters to try in order
   * @param operation Function that executes operation on adapter
   * @returns Result from first successful operation
   */
  async executeWithFallback<A>(
    adapters: A[],
    operation: (adapter: A) => Promise<T>,
  ): Promise<T> {
    if (!adapters || adapters.length === 0) {
      throw new Error(`No adapters available for fallback: ${this.name}`);
    }

    let lastError: Error | null = null;

    for (let index = 0; index < adapters.length; index++) {
      const adapter = adapters[index];
      try {
        this.logger.debug(`Attempting operation with adapter ${index + 1}/${adapters.length}`);
        const result = await operation(adapter);
        
        if (index > 0) {
          this.logger.log(
            `Fallback successful: switched to adapter ${index + 1} for ${this.name}`,
          );
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Adapter ${index + 1} failed for ${this.name}: ${lastError.message}`,
        );

        if (index < adapters.length - 1) {
          this.logger.log(`Attempting fallback with next adapter...`);
        }
      }
    }

    throw new Error(
      `All adapters exhausted for ${this.name}. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Execute operation with fallback chain and custom failure handler
   */
  async executeWithFallbackAndHandler<A>(
    adapters: A[],
    operation: (adapter: A) => Promise<T>,
    onEachFailure?: (adapter: A, error: Error, index: number) => void,
  ): Promise<T> {
    if (!adapters || adapters.length === 0) {
      throw new Error(`No adapters available for fallback: ${this.name}`);
    }

    let lastError: Error | null = null;

    for (let index = 0; index < adapters.length; index++) {
      const adapter = adapters[index];
      try {
        return await operation(adapter);
      } catch (error) {
        lastError = error as Error;
        
        if (onEachFailure) {
          onEachFailure(adapter, lastError, index);
        }

        if (index === adapters.length - 1) {
          break;
        }
      }
    }

    throw lastError || new Error(`All adapters failed for ${this.name}`);
  }

  /**
   * Get preferred adapter from list (based on priority or health)
   */
  selectAdapter<A extends { getName?: () => string }>(
    adapters: A[],
    preference?: string,
  ): A | null {
    if (!adapters || adapters.length === 0) {
      return null;
    }

    if (preference) {
      const preferred = adapters.find(
        (a) => a.getName?.() === preference,
      );
      if (preferred) {
        return preferred;
      }
    }

    return adapters[0];
  }
}
