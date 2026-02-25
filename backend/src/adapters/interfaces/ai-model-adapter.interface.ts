import { IAdapter } from './base-adapter.interface';

/**
 * AI Model adapter interface for handling AI provider operations.
 * Abstracts AI providers (OpenAI, Llama, Grok) from business logic.
 */
export interface IAIModelAdapter extends IAdapter {
  /**
   * Execute a scoring operation with the AI provider
   * @param userData The user data to score
   * @returns Normalized scoring result
   */
  score(userData: Record<string, any>): Promise<NormalizedScoringResult>;

  /**
   * Get provider-specific capabilities
   */
  getCapabilities(): AIProviderCapabilities;

  /**
   * Estimate cost for an operation (optional)
   * @param userData The data that would be processed
   */
  estimateCost?(userData: Record<string, any>): Promise<number>;

  /**
   * Test connection to the provider
   */
  testConnection(): Promise<boolean>;
}

export interface NormalizedScoringResult {
  provider: string;
  creditScore: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very-high';
  rawResponse: any;
  confidence?: number;
  processingTime?: number;
}

export interface AIProviderCapabilities {
  supportsCreditScoring: boolean;
  supportsRiskAnalysis: boolean;
  supportsRealTimeProcessing: boolean;
  maxRequestSize: number;
  averageResponseTime: number;
  costPerRequest?: number;
}

export enum AIProvider {
  OPENAI = 'openai',
  LLAMA = 'llama',
  GROK = 'grok',
}
