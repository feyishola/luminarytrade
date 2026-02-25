import { ConfigService } from '@nestjs/config';
import { BaseAIModelAdapter } from './base-ai-model.adapter';
import {
  NormalizedScoringResult,
  AIProviderCapabilities,
  AIProvider,
} from '../interfaces/ai-model-adapter.interface';
import axios, { AxiosInstance } from 'axios';

/**
 * Llama Adapter
 * Wraps Llama API calls with adapter interface
 */
export class LlamaAdapter extends BaseAIModelAdapter {
  private client: AxiosInstance;
  private apiKey: string;
  private apiEndpoint: string;

  constructor(apiKey: string, endpoint?: string) {
    super(AIProvider.LLAMA);
    this.apiKey = apiKey;
    this.apiEndpoint = endpoint || 'https://api.llama.com';

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
      throw new Error('Llama API key not configured');
    }

    return this.withRetry(async () => {
      const prompt = this.buildScoringPrompt(userData);

      const response = await this.client.post('/chat/completions', {
        model: 'llama-2-70b',
        messages: [
          {
            role: 'system',
            content: 'You are a financial risk assessment AI.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      });

      const result = JSON.parse(response.data.choices[0].message.content);

      return {
        provider: AIProvider.LLAMA,
        creditScore: this.normalizeScore(result.creditScore, 300, 850),
        riskScore: result.riskScore,
        riskLevel: this.calculateRiskLevel(result.riskScore),
        confidence: result.confidence || 0.8,
        rawResponse: response.data,
      };
    }, 'Llama scoring');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await this.client.get('/health', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      this.logger.warn('Llama health check failed:', error);
      return false;
    }
  }

  getCapabilities(): AIProviderCapabilities {
    return {
      supportsCreditScoring: true,
      supportsRiskAnalysis: true,
      supportsRealTimeProcessing: true,
      maxRequestSize: 4096,
      averageResponseTime: 3000,
      costPerRequest: 0.01,
    };
  }

  private buildScoringPrompt(userData: Record<string, any>): string {
    return `
      Analyze the following user data for credit risk:
      Return JSON with: creditScore (300-850), riskScore (0-100), confidence (0-1)
      
      User Data: ${JSON.stringify(userData)}
    `;
  }
}
