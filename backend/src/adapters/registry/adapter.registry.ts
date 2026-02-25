import { Injectable, Logger } from '@nestjs/common';
import { IAdapter } from '../interfaces/base-adapter.interface';
import {
  IWalletAdapter,
  WalletProvider,
} from '../interfaces/wallet-adapter.interface';
import {
  IAIModelAdapter,
  AIProvider,
} from '../interfaces/ai-model-adapter.interface';

/**
 * Adapter Registry - Central registry for all adapters.
 * Manages registration, discovery, and lifecycle of adapters.
 */
@Injectable()
export class AdapterRegistry {
  private readonly logger = new Logger(AdapterRegistry.name);

  private walletAdapters = new Map<string, IWalletAdapter>();
  private aiAdapters = new Map<string, IAIModelAdapter>();
  private defaultWalletAdapter: string | null = null;
  private defaultAIAdapter: string | null = null;

  /**
   * Register a wallet adapter
   */
  registerWalletAdapter(
    adapter: IWalletAdapter,
    setAsDefault: boolean = false,
  ): void {
    const name = adapter.getName();
    this.walletAdapters.set(name, adapter);
    this.logger.log(`Registered wallet adapter: ${name}`);

    if (setAsDefault || !this.defaultWalletAdapter) {
      this.defaultWalletAdapter = name;
      this.logger.log(`Set default wallet adapter: ${name}`);
    }
  }

  /**
   * Register an AI model adapter
   */
  registerAIAdapter(
    adapter: IAIModelAdapter,
    setAsDefault: boolean = false,
  ): void {
    const name = adapter.getName();
    this.aiAdapters.set(name, adapter);
    this.logger.log(`Registered AI adapter: ${name}`);

    if (setAsDefault || !this.defaultAIAdapter) {
      this.defaultAIAdapter = name;
      this.logger.log(`Set default AI adapter: ${name}`);
    }
  }

  /**
   * Get a wallet adapter by name
   */
  getWalletAdapter(name?: string): IWalletAdapter | null {
    const adapterName = name || this.defaultWalletAdapter;
    if (!adapterName) {
      this.logger.warn('No wallet adapter found');
      return null;
    }

    const adapter = this.walletAdapters.get(adapterName);
    if (!adapter) {
      this.logger.warn(`Wallet adapter not found: ${adapterName}`);
      return null;
    }

    return adapter;
  }

  /**
   * Get an AI model adapter by name
   */
  getAIAdapter(name?: string): IAIModelAdapter | null {
    const adapterName = name || this.defaultAIAdapter;
    if (!adapterName) {
      this.logger.warn('No AI adapter found');
      return null;
    }

    const adapter = this.aiAdapters.get(adapterName);
    if (!adapter) {
      this.logger.warn(`AI adapter not found: ${adapterName}`);
      return null;
    }

    return adapter;
  }

  /**
   * Get all registered wallet adapters
   */
  getAllWalletAdapters(): IWalletAdapter[] {
    return Array.from(this.walletAdapters.values());
  }

  /**
   * Get all registered AI adapters
   */
  getAllAIAdapters(): IAIModelAdapter[] {
    return Array.from(this.aiAdapters.values());
  }

  /**
   * Get all healthy wallet adapters
   */
  async getHealthyWalletAdapters(): Promise<IWalletAdapter[]> {
    const adapters = Array.from(this.walletAdapters.values());
    const healthyAdapters: IWalletAdapter[] = [];

    for (const adapter of adapters) {
      try {
        if (await adapter.isHealthy()) {
          healthyAdapters.push(adapter);
        }
      } catch (error) {
        this.logger.warn(
          `Health check failed for wallet adapter ${adapter.getName()}:`,
          error,
        );
      }
    }

    return healthyAdapters;
  }

  /**
   * Get all healthy AI adapters
   */
  async getHealthyAIAdapters(): Promise<IAIModelAdapter[]> {
    const adapters = Array.from(this.aiAdapters.values());
    const healthyAdapters: IAIModelAdapter[] = [];

    for (const adapter of adapters) {
      try {
        if (await adapter.isHealthy()) {
          healthyAdapters.push(adapter);
        }
      } catch (error) {
        this.logger.warn(
          `Health check failed for AI adapter ${adapter.getName()}:`,
          error,
        );
      }
    }

    return healthyAdapters;
  }

  /**
   * Get health status of all adapters
   */
  async getAdapterHealth(): Promise<Record<string, Record<string, boolean>>> {
    const health: Record<string, Record<string, boolean>> = {
      wallet: {},
      ai: {},
    };

    for (const [name, adapter] of this.walletAdapters.entries()) {
      try {
        health.wallet[name] = await adapter.isHealthy();
      } catch (error) {
        health.wallet[name] = false;
      }
    }

    for (const [name, adapter] of this.aiAdapters.entries()) {
      try {
        health.ai[name] = await adapter.isHealthy();
      } catch (error) {
        health.ai[name] = false;
      }
    }

    return health;
  }

  /**
   * Set default wallet adapter
   */
  setDefaultWalletAdapter(name: string): boolean {
    if (!this.walletAdapters.has(name)) {
      this.logger.warn(`Wallet adapter not found: ${name}`);
      return false;
    }
    this.defaultWalletAdapter = name;
    this.logger.log(`Default wallet adapter set to: ${name}`);
    return true;
  }

  /**
   * Set default AI adapter
   */
  setDefaultAIAdapter(name: string): boolean {
    if (!this.aiAdapters.has(name)) {
      this.logger.warn(`AI adapter not found: ${name}`);
      return false;
    }
    this.defaultAIAdapter = name;
    this.logger.log(`Default AI adapter set to: ${name}`);
    return true;
  }

  /**
   * Unregister a wallet adapter
   */
  unregisterWalletAdapter(name: string): boolean {
    const removed = this.walletAdapters.delete(name);
    if (removed) {
      this.logger.log(`Unregistered wallet adapter: ${name}`);
      if (this.defaultWalletAdapter === name) {
        this.defaultWalletAdapter = this.walletAdapters.keys().next().value || null;
      }
    }
    return removed;
  }

  /**
   * Unregister an AI adapter
   */
  unregisterAIAdapter(name: string): boolean {
    const removed = this.aiAdapters.delete(name);
    if (removed) {
      this.logger.log(`Unregistered AI adapter: ${name}`);
      if (this.defaultAIAdapter === name) {
        this.defaultAIAdapter = this.aiAdapters.keys().next().value || null;
      }
    }
    return removed;
  }
}
