import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  IWalletAdapter,
  WalletProvider,
} from '../interfaces/wallet-adapter.interface';
import {
  IAIModelAdapter,
  AIProvider,
} from '../interfaces/ai-model-adapter.interface';
import { AdapterRegistry } from '../registry/adapter.registry';
import { StellarWalletAdapter } from '../wallet/stellar-wallet.adapter';
import { CircuitBreaker } from '../patterns/circuit-breaker';
import { FallbackHandler } from '../patterns/fallback-handler';

/**
 * Adapter Factory
 * Creates and configures adapters with circuit breaker and fallback support.
 */
@Injectable()
export class AdapterFactory {
  private readonly logger = new Logger(AdapterFactory.name);
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private fallbackHandlers = new Map<string, FallbackHandler<any>>();

  constructor(private readonly registry: AdapterRegistry) {
    this.initializeCircuitBreakers();
  }

  /**
   * Initialize circuit breakers for all registered adapters
   */
  private initializeCircuitBreakers(): void {
    // Wallet adapters
    this.circuitBreakers.set(
      WalletProvider.STELLAR,
      new CircuitBreaker(WalletProvider.STELLAR),
    );

    // AI adapters
    this.circuitBreakers.set(
      AIProvider.OPENAI,
      new CircuitBreaker(AIProvider.OPENAI),
    );
    this.circuitBreakers.set(
      AIProvider.LLAMA,
      new CircuitBreaker(AIProvider.LLAMA),
    );
    this.circuitBreakers.set(
      AIProvider.GROK,
      new CircuitBreaker(AIProvider.GROK),
    );
  }

  /**
   * Create a Stellar wallet adapter
   */
  createStellarWalletAdapter(
    network: string = 'testnet',
  ): IWalletAdapter {
    this.logger.log(`Creating Stellar wallet adapter for network: ${network}`);
    return new StellarWalletAdapter(network);
  }

  /**
   * Get a wallet adapter with circuit breaker protection
   */
  async getWalletAdapterWithProtection(
    provider?: string,
  ): Promise<IWalletAdapter> {
    const adapter = this.registry.getWalletAdapter(provider);

    if (!adapter) {
      throw new BadRequestException(
        `Wallet adapter not found: ${provider || 'default'}`,
      );
    }

    // Verify adapter is configured and healthy
    if (!adapter.isConfigured()) {
      throw new BadRequestException(
        `Wallet adapter not configured: ${adapter.getName()}`,
      );
    }

    try {
      const isHealthy = await adapter.isHealthy();
      if (!isHealthy) {
        this.logger.warn(
          `Wallet adapter health check failed: ${adapter.getName()}`,
        );
      }
    } catch (error) {
      this.logger.error(`Health check error for wallet adapter:`, error);
    }

    return adapter;
  }

  /**
   * Get an AI adapter with circuit breaker protection
   */
  async getAIAdapterWithProtection(
    provider?: string,
  ): Promise<IAIModelAdapter> {
    const adapter = this.registry.getAIAdapter(provider);

    if (!adapter) {
      throw new BadRequestException(
        `AI adapter not found: ${provider || 'default'}`,
      );
    }

    // Verify adapter is configured
    if (!adapter.isConfigured()) {
      throw new BadRequestException(
        `AI adapter not configured: ${adapter.getName()}`,
      );
    }

    return adapter;
  }

  /**
   * Execute AI operation with circuit breaker and fallback
   */
  async executeAIOperationWithFallback<T>(
    operation: (adapter: IAIModelAdapter) => Promise<T>,
    preferredProvider?: string,
  ): Promise<T> {
    const allAdapters = this.registry.getAllAIAdapters();

    if (!allAdapters || allAdapters.length === 0) {
      throw new BadRequestException('No AI adapters configured');
    }

    // Sort adapters by preference
    const orderedAdapters = this.orderAdapters(
      allAdapters,
      preferredProvider,
    );

    let lastError: Error | null = null;

    for (const adapter of orderedAdapters) {
      const breaker = this.circuitBreakers.get(adapter.getName());

      try {
        if (breaker) {
          return await breaker.execute(() => operation(adapter));
        } else {
          return await operation(adapter);
        }
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `AI operation failed with ${adapter.getName()}: ${lastError.message}`,
        );
        continue;
      }
    }

    throw lastError || new Error('All AI adapters failed');
  }

  /**
   * Execute wallet operation with circuit breaker
   */
  async executeWalletOperationWithProtection<T>(
    operation: (adapter: IWalletAdapter) => Promise<T>,
    provider?: string,
  ): Promise<T> {
    const adapter = await this.getWalletAdapterWithProtection(provider);
    const breaker = this.circuitBreakers.get(adapter.getName());

    if (breaker) {
      return await breaker.execute(() => operation(adapter));
    } else {
      return await operation(adapter);
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, breaker] of this.circuitBreakers.entries()) {
      stats[name] = breaker.getStats();
    }

    return stats;
  }

  /**
   * Reset circuit breaker for a specific provider
   */
  resetCircuitBreaker(providerName: string): boolean {
    const breaker = this.circuitBreakers.get(providerName);
    if (!breaker) {
      this.logger.warn(`Circuit breaker not found: ${providerName}`);
      return false;
    }

    breaker.reset();
    return true;
  }

  /**
   * Order adapters by preference and health
   */
  private orderAdapters<T extends { getName: () => string }>(
    adapters: T[],
    preferred?: string,
  ): T[] {
    if (!preferred) {
      return adapters;
    }

    const ordered = adapters.sort((a, b) => {
      if (a.getName() === preferred) return -1;
      if (b.getName() === preferred) return 1;
      return 0;
    });

    return ordered;
  }

  /**
   * Get available AI adapters ordered by health and preference
   */
  async getAvailableAIAdapters(
    preferred?: string,
  ): Promise<IAIModelAdapter[]> {
    const healthy = await this.registry.getHealthyAIAdapters();
    return this.orderAdapters(healthy, preferred);
  }

  /**
   * Get available wallet adapters ordered by health and preference
   */
  async getAvailableWalletAdapters(
    preferred?: string,
  ): Promise<IWalletAdapter[]> {
    const healthy = await this.registry.getHealthyWalletAdapters();
    return this.orderAdapters(healthy, preferred);
  }
}
