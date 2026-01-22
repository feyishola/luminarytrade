import { Injectable } from '@nestjs/common';
import { BaseAIProvider } from './base-ai-provider';
import { NormalizedScoringResult } from '../dto/ai-scoring.dto';
import axios, { AxiosInstance } from 'axios';
import { AIProvider } from '../entities/ai-result-entity';

@Injectable()
export class OpenAIProvider extends BaseAIProvider {
  private client: AxiosInstance;

  constructor(apiKey: string, options?: { maxRetries?: number; timeout?: number }) {
    super(apiKey, AIProvider.OPENAI, options);
    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: this.timeout,
    });
  }

  async score(userData: Record<string, any>): Promise<NormalizedScoringResult> {
    return this.withRetry(async () => {
      const prompt = this.buildScoringPrompt(userData);
      
      const response = await this.client.post('/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a credit risk assessment AI. Analyze user financial data and return a JSON response with creditScore (300-850), riskScore (0-100), and reasoning.',
          },
          {
            role: 'user',
            content: prompt,
          },
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
        reasoning: result.reasoning,
        rawResponse: response.data,
      };
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.get('/models');
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  private buildScoringPrompt(userData: Record<string, any>): string {
    return `Analyze this financial profile and return JSON with creditScore (300-850), riskScore (0-100), confidence (0-1), and reasoning:
    
${JSON.stringify(userData, null, 2)}

Consider income, expenses, debt-to-income ratio, credit history, employment stability, and other relevant factors.`;
  }
}