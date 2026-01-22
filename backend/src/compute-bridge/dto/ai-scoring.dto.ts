import { IsString, IsNotEmpty, IsObject, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { AIProvider } from '../entities/ai-result-entity';

export class ScoringRequestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsObject()
  @IsNotEmpty()
  userData: {
    income?: number;
    expenses?: number;
    creditHistory?: any[];
    employmentStatus?: string;
    age?: number;
    debt?: number;
    [key: string]: any;
  };

  @IsEnum(AIProvider)
  @IsOptional()
  preferredProvider?: AIProvider;
}

export class NormalizedScoringResult {
  provider: AIProvider;
  creditScore: number; // 0-100
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'very-high';
  confidence: number;
  reasoning?: string;
  rawResponse: Record<string, any>;
}

export class ScoringResponseDto {
  resultId: string;
  userId: string;
  provider: AIProvider;
  creditScore: number;
  riskScore: number;
  riskLevel: string;
  signature: string;
  completedAt: Date;
}

export class AIProviderConfig {
  @IsString()
  apiKey: string;

  @IsString()
  @IsOptional()
  endpoint?: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxRetries?: number;

  @IsNumber()
  @Min(1000)
  @IsOptional()
  timeout?: number;
}