import { Logger } from '@nestjs/common';

/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by failing fast when a service is down.
 */
export class CircuitBreaker {
  private readonly logger: Logger;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;

  constructor(
    private readonly name: string,
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 60000, // 1 minute
    private readonly successThreshold: number = 2,
  ) {
    this.logger = new Logger(`CircuitBreaker-${name}`);
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.logger.log(`Circuit breaker transitioning to HALF_OPEN: ${this.name}`);
      } else {
        throw new Error(
          `Circuit breaker is OPEN for ${this.name}. Service unavailable.`,
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        this.logger.log(`Circuit breaker is now CLOSED: ${this.name}`);
      }
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.logger.warn(
        `Circuit breaker is now OPEN: ${this.name} (failures: ${this.failureCount})`,
      );
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  getState(): string {
    return this.state;
  }

  getStats(): {
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.logger.log(`Circuit breaker reset: ${this.name}`);
  }
}
