/**
 * Base adapter interface for all external service integrations.
 * Ensures consistent adapter behavior and configuration management.
 */
export interface IAdapter {
  /**
   * Get unique identifier for the adapter
   */
  getName(): string;

  /**
   * Check if adapter is properly configured and ready to use
   */
  isConfigured(): boolean;

  /**
   * Perform health check on the external service
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get adapter metadata and capabilities
   */
  getMetadata(): AdapterMetadata;
}

export interface AdapterMetadata {
  name: string;
  version: string;
  provider: string;
  capabilities: string[];
  isAsync: boolean;
  supportsRetry: boolean;
  supportsCircuitBreaker: boolean;
}

export interface AdapterConfig {
  maxRetries?: number;
  timeout?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeout?: number;
}
