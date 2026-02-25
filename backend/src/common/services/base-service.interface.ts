/**
 * Base service interface defining contract for all service classes
 * Ensures Liskov Substitution Principle compliance across service hierarchy
 */

/**
 * Core service contract interface
 * All services must implement these fundamental operations
 */
export interface IBaseService<T = any> {
  /**
   * Get service name/identifier
   * @returns Unique service identifier
   */
  getName(): string;

  /**
   * Check if service is properly configured and ready
   * @returns true if service is ready, false otherwise
   */
  isConfigured(): boolean;

  /**
   * Perform health check on service dependencies
   * @returns true if healthy, false otherwise
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get service metadata and capabilities
   * @returns Service metadata
   */
  getMetadata(): ServiceMetadata;

  /**
   * Initialize service with required dependencies
   * @param config Configuration options
   */
  initialize?(config?: ServiceConfig): Promise<void>;

  /**
   * Cleanup service resources
   */
  destroy?(): Promise<void>;
}

/**
 * Service metadata structure
 */
export interface ServiceMetadata {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  dependencies: string[];
  isAsync: boolean;
  supportsTransactions: boolean;
  errorHandlingStrategy: ErrorHandlingStrategy;
}

/**
 * Service configuration options
 */
export interface ServiceConfig {
  maxRetries?: number;
  timeout?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeout?: number;
  [key: string]: any;
}

/**
 * Error handling strategies
 */
export enum ErrorHandlingStrategy {
  THROW = 'throw',
  RETRY = 'retry',
  FALLBACK = 'fallback',
  CIRCUIT_BREAKER = 'circuit_breaker'
}

/**
 * Contract specification for service methods
 * Defines preconditions, postconditions, and invariants
 */
export interface ServiceContract {
  /**
   * Method name
   */
  method: string;
  
  /**
   * Preconditions that must be true before method execution
   */
  preconditions: string[];
  
  /**
   * Postconditions that must be true after method execution
   */
  postconditions: string[];
  
  /**
   * Invariants that must remain true throughout execution
   */
  invariants: string[];
  
  /**
   * Expected exceptions and error conditions
   */
  exceptions: Array<{
    type: string;
    condition: string;
    recovery: string;
  }>;
  
  /**
   * Performance characteristics
   */
  performance: {
    expectedLatency: string;
    maxLatency: string;
    throughput: string;
  };
}