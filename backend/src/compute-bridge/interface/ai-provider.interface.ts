import { NormalizedScoringResult } from '../dto/ai-scoring.dto';
import { ServiceContract } from '../../common/services/base-service.interface';

/**
 * AI Provider contract interface
 * Defines the complete contract for AI provider implementations
 * Ensures Liskov Substitution Principle compliance
 */
export interface IAIProvider {
  /**
   * Execute scoring operation with the AI provider
   * @param userData The user data to score
   * @returns Normalized scoring result
   * @throws AIProviderError if scoring fails
   */
  score(userData: Record<string, any>): Promise<NormalizedScoringResult>;
  
  /**
   * Get provider name/identifier
   * @returns Unique provider identifier
   */
  getName(): string;
  
  /**
   * Check provider health status
   * @returns true if provider is healthy, false otherwise
   */
  isHealthy(): Promise<boolean>;
  
  /**
   * Get provider capabilities and metadata
   * @returns Provider capabilities
   */
  getCapabilities(): AIProviderCapabilities;
  
  /**
   * Validate if provider is properly configured
   * @returns true if configured, false otherwise
   */
  isConfigured(): boolean;
  
  /**
   * Estimate cost for an operation (optional)
   * @param userData The data that would be processed
   * @returns Estimated cost in USD
   */
  estimateCost?(userData: Record<string, any>): Promise<number>;
  
  /**
   * Test connection to the provider
   * @returns true if connection successful, false otherwise
   */
  testConnection(): Promise<boolean>;
}

/**
 * AI Provider capabilities specification
 */
export interface AIProviderCapabilities {
  /**
   * Provider supports credit scoring operations
   */
  supportsCreditScoring: boolean;
  
  /**
   * Provider supports risk analysis operations
   */
  supportsRiskAnalysis: boolean;
  
  /**
   * Provider supports real-time processing
   */
  supportsRealTimeProcessing: boolean;
  
  /**
   * Maximum request size in bytes
   */
  maxRequestSize: number;
  
  /**
   * Average response time in milliseconds
   */
  averageResponseTime: number;
  
  /**
   * Cost per request in USD (optional)
   */
  costPerRequest?: number;
  
  /**
   * Supported data formats
   */
  supportedFormats: string[];
  
  /**
   * Rate limits (requests per minute)
   */
  rateLimit?: number;
}

/**
 * AI Provider contract specification
 * Defines behavioral contracts for all AI provider implementations
 */
export const AI_PROVIDER_CONTRACT: ServiceContract = {
  method: 'score',
  preconditions: [
    'arg0 != null',
    'arg0.userData != null',
    'this.isConfigured() === true'
  ],
  postconditions: [
    'result != null',
    'result.creditScore >= 0',
    'result.creditScore <= 100',
    'result.riskScore >= 0',
    'result.riskScore <= 100'
  ],
  invariants: [
    'this.getName() != null',
    'this.getCapabilities() != null'
  ],
  exceptions: [
    {
      type: 'AIProviderError',
      condition: 'error.code === "INVALID_INPUT"',
      recovery: 'Validate input data and retry with corrected format'
    },
    {
      type: 'AIProviderError',
      condition: 'error.code === "RATE_LIMIT_EXCEEDED"',
      recovery: 'Wait for rate limit reset and retry'
    },
    {
      type: 'AIProviderError',
      condition: 'error.code === "SERVICE_UNAVAILABLE"',
      recovery: 'Switch to fallback provider or retry after delay'
    }
  ],
  performance: {
    expectedLatency: '500ms',
    maxLatency: '5000ms',
    throughput: '10 requests/second'
  }
};

/**
 * AI Provider error types
 */
export class AIProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export enum AIProviderErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TIMEOUT = 'TIMEOUT'
}