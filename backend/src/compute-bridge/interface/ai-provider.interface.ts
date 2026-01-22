import { NormalizedScoringResult } from '../dto/ai-scoring.dto';

export interface IAIProvider {
  score(userData: Record<string, any>): Promise<NormalizedScoringResult>;
  getName(): string;
  isHealthy(): Promise<boolean>;
}