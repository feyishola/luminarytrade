import { ConfigService } from '@nestjs/config';
import { BaseAIModelAdapter } from './base-ai-model.adapter';
import {
  NormalizedScoringResult,
  AIProviderCapabilities,
  AIProvider,
} from '../interfaces/ai-model-adapter.interface';
import axios, { AxiosInstance } from 'axios';

/**
 * OpenAI Adapter
 * Wraps OpenAI API calls with adapter interface
 */
export class OpenAIAdapter extends BaseAIModelAdapter {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(private readonly configService: ConfigService) {
    super(AIProvider.OPENAI);
    this.apiKey = configService.get<string>('OPENAI_API_KEY') || '';

    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
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
      throw new Error('OpenAI API key not configured');
    }

    return this.withRetry(async () => {
      const prompt = this.buildScoringPrompt(userData);

      const response = await this.client.post('/chat/completions', {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a credit risk AI.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.data.choices[0].message.content);

      return {
        provider: AIProvider.OPENAI,
        creditScore: this.normalizeScore(result.creditScore, 300, 850),
        riskScore: result.riskScore,
        riskLevel: this.calculateRiskLevel(result.riskScore),
        confidence: result.confidence || 0.85,
        rawResponse: response.data,
      };
    }, 'OpenAI scoring');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await this.client.get('/models', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      this.logger.warn('OpenAI health check failed:', error);
      return false;
    }
  }

  getCapabilities(): AIProviderCapabilities {
    return {
      supportsCreditScoring: true,
      supportsRiskAnalysis: true,
      supportsRealTimeProcessing: true,
      maxRequestSize: 128000,
      averageResponseTime: 2000,
      costPerRequest: 0.03,
    };
  }

  private buildScoringPrompt(userData: Record<string, any>): string {
    return `
      Analyze the following user data for credit risk and provide a JSON response with:
      - creditScore (300-850)
      - riskScore (0-100)
      - confidence (0-1)
      - reasoning (string)
      
      User Data: ${JSON.stringify(userData)}
      
      Respond only with valid JSON.
    `;
  }
}
