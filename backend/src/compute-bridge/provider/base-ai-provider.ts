import { Logger } from '@nestjs/common';
import { NormalizedScoringResult } from '../dto/ai-scoring.dto';
import { AIProvider } from '../entities/ai-result-entity';
import { IAIProvider } from '../interface/ai-provider.interface';

export abstract class BaseAIProvider implements IAIProvider {
  protected readonly logger: Logger;
  protected readonly maxRetries: number;
  protected readonly timeout: number;

  constructor(
    protected readonly apiKey: string,
    protected readonly providerName: AIProvider,
    options?: { maxRetries?: number; timeout?: number },
  ) {
    this.logger = new Logger(`${providerName.toUpperCase()}Provider`);
    this.maxRetries = options?.maxRetries || 3;
    this.timeout = options?.timeout || 30000;
  }

  abstract score(userData: Record<string, any>): Promise<NormalizedScoringResult>;
  
  abstract isHealthy(): Promise<boolean>;

  getName(): string {
    return this.providerName;
  }

  protected normalizeScore(score: number, min: number, max: number): number {
    // Normalize to 0-100 scale
    return Math.round(((score - min) / (max - min)) * 100);
  }

  protected calculateRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'very-high' {
    if (riskScore <= 25) return 'low';
    if (riskScore <= 50) return 'medium';
    if (riskScore <= 75) return 'high';
    return 'very-high';
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.maxRetries,
  ): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        this.logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }
}