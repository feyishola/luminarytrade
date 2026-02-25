import { Logger } from "@nestjs/common";
import { NormalizedScoringResult, AIProviderCapabilities } from "../interface/ai-provider.interface";
import { AIProvider } from "../entities/ai-result-entity";
import { IAIProvider, AIProviderError, AIProviderErrorCode } from "../interface/ai-provider.interface";
import {
  IPlugin,
  PluginMetadata,
} from "../../plugins/interfaces/plugin.interface";
import { getPluginMetadata } from "../../plugins/decorators/plugin.decorator";
import { BaseService } from "../../common/services/base.service";
import { Contract, Performance } from "../../common/decorators/contract.decorator";
import { AI_PROVIDER_CONTRACT } from "../interface/ai-provider.interface";

/**
 * Abstract base class for AI providers
 * Implements LSP-compliant contract and provides common functionality
 */
export abstract class BaseAIProvider extends BaseService implements IAIProvider, IPlugin {
  protected readonly providerName: AIProvider;
  protected readonly apiKey: string;
  protected readonly capabilities: AIProviderCapabilities;

  constructor(
    apiKey: string,
    providerName: AIProvider,
    capabilities: AIProviderCapabilities,
    options?: { maxRetries?: number; timeout?: number },
  ) {
    super(`${providerName.toUpperCase()}Provider`, options);
    this.apiKey = apiKey;
    this.providerName = providerName;
    this.capabilities = capabilities;
  }

  /**
   * Execute scoring operation with contract enforcement
   */
  @Contract(AI_PROVIDER_CONTRACT)
  @Performance(AI_PROVIDER_CONTRACT)
  abstract score(
    userData: Record<string, any>,
  ): Promise<NormalizedScoringResult>;

  /**
   * Check provider health status
   */
  abstract isHealthy(): Promise<boolean>;

  /**
   * Get provider name
   */
  getName(): string {
    return this.providerName;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): AIProviderCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Get plugin metadata
   */
  getMetadata(): PluginMetadata {
    const metadata = getPluginMetadata(this);
    if (!metadata) {
      return {
        name: this.getName(),
        version: "1.0.0",
        description: `AI Provider for ${this.getName()}`,
      };
    }
    return metadata;
  }

  /**
   * Test connection to the provider
   */
  async testConnection(): Promise<boolean> {
    try {
      this.assertInitialized();
      return await this.isHealthy();
    } catch (error) {
      this.logger.error(`Connection test failed:`, error);
      return false;
    }
  }

  /**
   * Plugin lifecycle methods
   */
  async onInit(): Promise<void> {
    this.logger.log(`Initializing plugin: ${this.getName()}`);
    await this.initialize();
  }

  async onEnable(): Promise<void> {
    this.logger.log(`Enabling plugin: ${this.getName()}`);
  }

  async onDisable(): Promise<void> {
    this.logger.log(`Disabling plugin: ${this.getName()}`);
  }

  async onDestroy(): Promise<void> {
    this.logger.log(`Destroying plugin: ${this.getName()}`);
    await this.destroy();
  }

  /**
   * Protected utility methods
   */
  
  protected normalizeScore(score: number, min: number, max: number): number {
    // Normalize to 0-100 scale
    if (max === min) return 50; // Avoid division by zero
    return Math.max(0, Math.min(100, Math.round(((score - min) / (max - min)) * 100)));
  }

  protected calculateRiskLevel(
    riskScore: number,
  ): "low" | "medium" | "high" | "very-high" {
    if (riskScore < 0 || riskScore > 100) {
      throw new AIProviderError(
        AIProviderErrorCode.INVALID_INPUT,
        `Invalid risk score: ${riskScore}. Must be between 0 and 100.`
      );
    }
    
    if (riskScore <= 25) return "low";
    if (riskScore <= 50) return "medium";
    if (riskScore <= 75) return "high";
    return "very-high";
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.config.maxRetries,
  ): Promise<T> {
    return this.executeWithRetry(operation, retries);
  }

  protected validateUserData(userData: Record<string, any>): void {
    if (!userData || typeof userData !== 'object') {
      throw new AIProviderError(
        AIProviderErrorCode.INVALID_INPUT,
        'User data must be a valid object'
      );
    }
    
    if (Object.keys(userData).length === 0) {
      throw new AIProviderError(
        AIProviderErrorCode.INVALID_INPUT,
        'User data cannot be empty'
      );
    }
  }

  protected createProviderError(
    code: AIProviderErrorCode,
    message: string,
    details?: any
  ): AIProviderError {
    return new AIProviderError(code, message, details);
  }

  /**
   * Override BaseService methods
   */
  protected validateConfiguration(): void {
    super.validateConfiguration();
    
    if (!this.apiKey) {
      throw new Error('API key is required for AI provider');
    }
    
    if (!this.providerName) {
      throw new Error('Provider name is required');
    }
    
    if (!this.capabilities) {
      throw new Error('Provider capabilities must be defined');
    }
  }

  protected async onInitialize(): Promise<void> {
    // Validate provider-specific configuration
    if (!this.isConfigured()) {
      throw new Error(`Provider ${this.getName()} is not properly configured`);
    }
    
    // Test connection
    const isHealthy = await this.isHealthy();
    if (!isHealthy) {
      throw new Error(`Provider ${this.getName()} is not healthy`);
    }
    
    this.logger.log(`Provider ${this.getName()} initialized successfully`);
  }
}
