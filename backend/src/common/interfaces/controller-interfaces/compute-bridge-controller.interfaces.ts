import { ScoringRequestDto, ScoringResponseDto } from '../../../compute-bridge/dto/ai-scoring.dto';
import { AIResultEntity } from '../../../compute-bridge/entities/ai-result-entity';

// CRUD operations for Compute Bridge
export interface IComputeBridgeCRUD {
  scoreUser(request: ScoringRequestDto): Promise<ScoringResponseDto>;
  getResult(id: string): Promise<AIResultEntity>;
  getUserResults(userId: string): Promise<AIResultEntity[]>;
}

// Query operations for Compute Bridge
export interface IComputeBridgeQuery {
  healthCheck(): Promise<Record<string, boolean>>;
  verifyResult(id: string): Promise<{ valid: boolean }>;
}

// Analytics operations for Compute Bridge
export interface IComputeBridgeAnalytics {
  getStats(): Promise<any>; // Define specific stats type as needed
}