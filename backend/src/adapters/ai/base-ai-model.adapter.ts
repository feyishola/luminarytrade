import { Logger } from '@nestjs/common';
import {
  IAIModelAdapter,
  NormalizedScoringResult,
  AIProviderCapabilities,
  AIProvider,
} from '../interfaces/ai-model-adapter.interface';
import { AdapterConfig, AdapterMetadata } from '../interfaces/base-adapter.interface';

/**
 * Base AI Model adapter class.
 * Provides common functionality for all AI provider adapters.
 */
export abstract class BaseAIModelAdapter implements IAIModelAdapter {
  protected logger: Logger;
  protected readonly config: AdapterConfig;

  constructor(
    protected readonly providerName: AIProvider,
    config?: AdapterConfig,
  ) {
    this.logger = new Logger(`${providerName.toUpperCase()}Adapter`);
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      retryDelay: 1000,
      ...config,
    };
  }

  abstract score(
    userData: Record<string, any>,
  ): Promise<NormalizedScoringResult>;

  abstract isHealthy(): Promise<boolean>;

  abstract getCapabilities(): AIProviderCapabilities;

  getName(): string {
    return this.providerName;
  }

  isConfigured(): boolean {
    return this.isApiKeyConfigured();
  }

  abstract isApiKeyConfigured(): boolean;

  getMetadata(): AdapterMetadata {
    return {
      name: `${this.providerName} AI Adapter`,
      version: '1.0.0',
      provider: this.providerName,
      capabilities: ['credit-scoring', 'risk-analysis'],
      isAsync: true,
      supportsRetry: true,
      supportsCircuitBreaker: true,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const testData = { test: true };
      const result = await this.score(testData);
      return result !== null;
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Retry logic for operations that may fail
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation',
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `${operationName} failed (attempt ${attempt}/${this.config.maxRetries}):`,
          error,
        );

        if (attempt < this.config.maxRetries!) {
          await this.delay(this.config.retryDelay! * attempt); // Exponential backoff
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after retries`);
  }

  /**
   * Delay utility for retry backoff
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Normalize score to 0-100 scale
   */
  protected normalizeScore(score: number, min: number, max: number): number {
    return Math.round(((score - min) / (max - min)) * 100);
  }

  /**
   * Calculate risk level based on risk score
   */
  protected calculateRiskLevel(
    riskScore: number,
  ): 'low' | 'medium' | 'high' | 'very-high' {
    if (riskScore <= 25) return 'low';
    if (riskScore <= 50) return 'medium';
    if (riskScore <= 75) return 'high';
    return 'very-high';
  }
}
