import { Logger } from '@nestjs/common';
import { IBaseService, ServiceMetadata, ServiceConfig, ErrorHandlingStrategy } from './base-service.interface';

/**
 * Abstract base service class implementing core service contract
 * Provides common functionality and enforces LSP compliance
 */
export abstract class BaseService<T = any> implements IBaseService<T> {
  protected readonly logger: Logger;
  protected readonly config: Required<ServiceConfig>;
  protected isInitialized: boolean = false;
  protected metadata: ServiceMetadata;

  constructor(
    protected readonly serviceName: string,
    config?: ServiceConfig
  ) {
    this.logger = new Logger(serviceName);
    this.config = this.mergeDefaultConfig(config || {});
    this.metadata = this.initializeMetadata();
  }

  /**
   * Get service name
   */
  getName(): string {
    return this.serviceName;
  }

  /**
   * Check if service is properly configured
   */
  abstract isConfigured(): boolean;

  /**
   * Perform health check
   */
  abstract isHealthy(): Promise<boolean>;

  /**
   * Get service metadata
   */
  getMetadata(): ServiceMetadata {
    return { ...this.metadata };
  }

  /**
   * Initialize service
   */
  async initialize(config?: ServiceConfig): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Service already initialized');
      return;
    }

    try {
      // Merge configuration
      if (config) {
        Object.assign(this.config, config);
      }

      // Validate configuration
      this.validateConfiguration();

      // Perform service-specific initialization
      await this.onInitialize();

      this.isInitialized = true;
      this.logger.log(`${this.serviceName} initialized successfully`);
    } catch (error) {
      this.logger.error(`Failed to initialize ${this.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup service resources
   */
  async destroy(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn('Service not initialized');
      return;
    }

    try {
      await this.onDestroy();
      this.isInitialized = false;
      this.logger.log(`${this.serviceName} destroyed successfully`);
    } catch (error) {
      this.logger.error(`Failed to destroy ${this.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Execute operation with retry logic and error handling
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retries) {
          this.logger.error(
            `Operation failed after ${retries + 1} attempts: ${lastError.message}`
          );
          throw lastError;
        }

        const delay = this.calculateRetryDelay(attempt);
        this.logger.warn(
          `Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`
        );
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Validate service preconditions
   */
  protected validatePreconditions(preconditions: Record<string, any>): void {
    for (const [condition, value] of Object.entries(preconditions)) {
      if (!value) {
        throw new Error(`Precondition failed: ${condition}`);
      }
    }
  }

  /**
   * Validate service postconditions
   */
  protected validatePostconditions(postconditions: Record<string, any>): void {
    for (const [condition, value] of Object.entries(postconditions)) {
      if (!value) {
        throw new Error(`Postcondition failed: ${condition}`);
      }
    }
  }

  /**
   * Service-specific initialization logic
   * Override in derived classes
   */
  protected async onInitialize(): Promise<void> {
    // Default implementation - can be overridden
  }

  /**
   * Service-specific cleanup logic
   * Override in derived classes
   */
  protected async onDestroy(): Promise<void> {
    // Default implementation - can be overridden
  }

  /**
   * Validate service configuration
   * Override in derived classes for specific validation
   */
  protected validateConfiguration(): void {
    // Default implementation - can be overridden
    if (!this.serviceName) {
      throw new Error('Service name is required');
    }
  }

  /**
   * Merge default configuration with provided config
   */
  private mergeDefaultConfig(config: ServiceConfig): Required<ServiceConfig> {
    const defaults: Required<ServiceConfig> = {
      maxRetries: 3,
      timeout: 30000,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 60000,
      ...config
    };
    return defaults;
  }

  /**
   * Initialize service metadata
   */
  private initializeMetadata(): ServiceMetadata {
    return {
      name: this.serviceName,
      version: '1.0.0',
      description: `${this.serviceName} service implementation`,
      capabilities: [],
      dependencies: [],
      isAsync: true,
      supportsTransactions: false,
      errorHandlingStrategy: ErrorHandlingStrategy.RETRY
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    return Math.min(
      this.config.retryDelay * Math.pow(2, attempt),
      this.config.timeout
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Assert service is initialized
   */
  protected assertInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`${this.serviceName} is not initialized`);
    }
  }
}