import { BaseAIModelAdapter } from './base-ai-model.adapter';
import {
  NormalizedScoringResult,
  AIProviderCapabilities,
  AIProvider,
} from '../interfaces/ai-model-adapter.interface';
import axios, { AxiosInstance } from 'axios';

/**
 * Grok Adapter
 * Wraps Grok API calls with adapter interface
 */
export class GrokAdapter extends BaseAIModelAdapter {
  private client: AxiosInstance;
  private apiKey: string;
  private apiEndpoint: string;

  constructor(apiKey: string, endpoint?: string) {
    super(AIProvider.GROK);
    this.apiKey = apiKey;
    this.apiEndpoint = endpoint || 'https://api.x.ai';

    this.client = axios.create({
      baseURL: this.apiEndpoint,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: this.config.timeout,
    });
  }

  isApiKeyConfigured(): boolean {
    return !!this.apiKey;
  }

  async score(
    userData: Record<string, any>,
  ): Promise<NormalizedScoringResult> {
    if (!this.apiKey) {
      throw new Error('Grok API key not configured');
    }

    return this.withRetry(async () => {
      const prompt = this.buildScoringPrompt(userData);

      const response = await this.client.post('/chat/completions', {
        model: 'grok-1',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in financial risk assessment.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      });

      const result = JSON.parse(response.data.choices[0].message.content);

      return {
        provider: AIProvider.GROK,
        creditScore: this.normalizeScore(result.creditScore, 300, 850),
        riskScore: result.riskScore,
        riskLevel: this.calculateRiskLevel(result.riskScore),
        confidence: result.confidence || 0.82,
        rawResponse: response.data,
      };
    }, 'Grok scoring');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await this.client.get('/models', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      this.logger.warn('Grok health check failed:', error);
      return false;
    }
  }

  getCapabilities(): AIProviderCapabilities {
    return {
      supportsCreditScoring: true,
      supportsRiskAnalysis: true,
      supportsRealTimeProcessing: true,
      maxRequestSize: 8192,
      averageResponseTime: 2500,
      costPerRequest: 0.02,
    };
  }

  private buildScoringPrompt(userData: Record<string, any>): string {
    return `
      Perform comprehensive credit risk analysis:
      Return JSON: {creditScore (300-850), riskScore (0-100), confidence (0-1)}
      
      Data: ${JSON.stringify(userData)}
    `;
  }
}
