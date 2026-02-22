import { BaseAIModelAdapter } from '../ai/base-ai-model.adapter';
import {
  NormalizedScoringResult,
  AIProviderCapabilities,
  AIProvider,
} from '../interfaces/ai-model-adapter.interface';

/**
 * Mock AI Adapter for Testing
 * Simulates AI provider operations without external dependencies
 */
export class MockAIAdapter extends BaseAIModelAdapter {
  private shouldFail = false;
  private mockResults: Map<string, NormalizedScoringResult> = new Map();

  constructor(providerName: AIProvider = AIProvider.OPENAI) {
    super(providerName);
    this.initializeDefaultMockData();
  }

  private initializeDefaultMockData(): void {
    // Add default mock result for generic user data
    this.mockResults.set('default', {
      provider: this.providerName,
      creditScore: 750,
      riskScore: 35,
      riskLevel: 'low',
      rawResponse: {
        model: this.providerName,
        reasoning: 'Excellent credit profile',
        confidence: 0.95,
      },
    });
  }

  isApiKeyConfigured(): boolean {
    return true;
  }

  async score(
    userData: Record<string, any>,
  ): Promise<NormalizedScoringResult> {
    if (this.shouldFail) {
      throw new Error(
        `Mock AI adapter (${this.providerName}) is configured to fail`,
      );
    }

    // Return mock result
    const result = this.mockResults.get('default');
    if (result) {
      return Promise.resolve(result);
    }

    throw new Error('No mock result configured');
  }

  async isHealthy(): Promise<boolean> {
    return !this.shouldFail;
  }

  getCapabilities(): AIProviderCapabilities {
    return {
      supportsCreditScoring: true,
      supportsRiskAnalysis: true,
      supportsRealTimeProcessing: true,
      maxRequestSize: 10000,
      averageResponseTime: 100, // Mock is fast
      costPerRequest: 0,
    };
  }

  /**
   * Test helper: Set failure state
   */
  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  /**
   * Test helper: Set mock scoring result
   */
  setMockResult(key: string, result: NormalizedScoringResult): void {
    this.mockResults.set(key, result);
  }

  /**
   * Test helper: Set default mock result
   */
  setDefaultMockResult(
    creditScore: number,
    riskScore: number,
    riskLevel: 'low' | 'medium' | 'high' | 'very-high',
  ): void {
    this.mockResults.set('default', {
      provider: this.providerName,
      creditScore,
      riskScore,
      riskLevel,
      rawResponse: {
        model: this.providerName,
        reasoning: `Mock result for ${this.providerName}`,
        confidence: 0.9,
      },
    });
  }
}
