
import { Injectable } from '@nestjs/common';
import { BaseAIProvider } from './base-ai-provider';
import { NormalizedScoringResult } from '../dto/ai-scoring.dto';
import axios, { AxiosInstance } from 'axios';
import { AIProvider } from '../entities/ai-result-entity';

@Injectable()
export class LlamaProvider extends BaseAIProvider {
  private client: AxiosInstance;

  constructor(
    apiKey: string,
    endpoint: string = 'https://api.together.xyz/v1',
    options?: { maxRetries?: number; timeout?: number },
  ) {
    super(apiKey, AIProvider.LLAMA, options);
    this.client = axios.create({
      baseURL: endpoint,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: this.timeout,
    });
  }

  async score(userData: Record<string, any>): Promise<NormalizedScoringResult> {
    return this.withRetry(async () => {
      const response = await this.client.post('/chat/completions', {
        model: 'meta-llama/Llama-3-70b-chat-hf',
        messages: [
          {
            role: 'system',
            content: 'Analyze financial data and return JSON: {creditScore: number (300-850), riskScore: number (0-100), reasoning: string}',
          },
          {
            role: 'user',
            content: JSON.stringify(userData),
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      const content = response.data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      
      return {
        provider: AIProvider.LLAMA,
        creditScore: this.normalizeScore(result.creditScore, 300, 850),
        riskScore: result.riskScore,
        riskLevel: this.calculateRiskLevel(result.riskScore),
        confidence: 0.75,
        reasoning: result.reasoning,
        rawResponse: response.data,
      };
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get('/models');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}