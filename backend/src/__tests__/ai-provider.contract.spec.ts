import { Test, TestingModule } from '@nestjs/testing';
import { IAIProvider, AIProviderCapabilities, AIProviderError } from '../../compute-bridge/interface/ai-provider.interface';
import { BaseAIProvider } from '../../compute-bridge/provider/base-ai-provider';
import { AIProvider } from '../../compute-bridge/entities/ai-result-entity';
import { NormalizedScoringResult } from '../../compute-bridge/dto/ai-scoring.dto';

/**
 * Mock AI provider implementation for testing
 */
class MockAIProvider extends BaseAIProvider {
  private healthy: boolean = true;
  private configured: boolean = true;

  constructor() {
    const capabilities: AIProviderCapabilities = {
      supportsCreditScoring: true,
      supportsRiskAnalysis: true,
      supportsRealTimeProcessing: true,
      maxRequestSize: 1024 * 1024, // 1MB
      averageResponseTime: 500,
      costPerRequest: 0.01,
      supportedFormats: ['json', 'xml'],
      rateLimit: 100
    };

    super('test-api-key', AIProvider.OPENAI, capabilities, { maxRetries: 3 });
  }

  async score(userData: Record<string, any>): Promise<NormalizedScoringResult> {
    if (!this.isConfigured()) {
      throw new AIProviderError('INVALID_CONFIGURATION', 'Provider not configured');
    }

    if (!userData || Object.keys(userData).length === 0) {
      throw new AIProviderError('INVALID_INPUT', 'User data is required');
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      provider: this.getName(),
      creditScore: 75,
      riskScore: 25,
      riskLevel: 'low',
      rawResponse: { userData, processed: true },
      confidence: 0.95,
      processingTime: 100
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.healthy;
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  isConfigured(): boolean {
    return this.configured && !!this.apiKey;
  }

  setConfigured(configured: boolean): void {
    this.configured = configured;
  }

  async estimateCost(userData: Record<string, any>): Promise<number> {
    return 0.01; // Fixed cost for testing
  }
}

/**
 * Behavioral specification tests for AI Provider contract
 * Ensures LSP compliance across all AI provider implementations
 */
describe('AIProvider Contract Specification', () => {
  let provider: MockAIProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockAIProvider],
    }).compile();

    provider = module.get<MockAIProvider>(MockAIProvider);
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.destroy();
  });

  describe('Provider Contract Compliance', () => {
    it('should implement IAIProvider interface', () => {
      expect(provider).toBeDefined();
      expect(typeof provider.score).toBe('function');
      expect(typeof provider.getName).toBe('function');
      expect(typeof provider.isHealthy).toBe('function');
      expect(typeof provider.getCapabilities).toBe('function');
      expect(typeof provider.isConfigured).toBe('function');
      expect(typeof provider.testConnection).toBe('function');
    });

    it('should return correct provider name', () => {
      expect(provider.getName()).toBe(AIProvider.OPENAI);
    });

    it('should return provider capabilities', () => {
      const capabilities = provider.getCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities.supportsCreditScoring).toBe(true);
      expect(capabilities.supportsRiskAnalysis).toBe(true);
      expect(capabilities.maxRequestSize).toBe(1024 * 1024);
      expect(Array.isArray(capabilities.supportedFormats)).toBe(true);
    });

    it('should validate configuration status', () => {
      expect(provider.isConfigured()).toBe(true);
      provider.setConfigured(false);
      expect(provider.isConfigured()).toBe(false);
    });

    it('should check health status', async () => {
      expect(await provider.isHealthy()).toBe(true);
      provider.setHealthy(false);
      expect(await provider.isHealthy()).toBe(false);
    });
  });

  describe('Scoring Contract', () => {
    it('should process valid user data', async () => {
      const userData = { userId: '123', income: 50000, debt: 10000 };
      const result = await provider.score(userData);
      
      expect(result).toBeDefined();
      expect(result.provider).toBe(AIProvider.OPENAI);
      expect(typeof result.creditScore).toBe('number');
      expect(typeof result.riskScore).toBe('number');
      expect(['low', 'medium', 'high', 'very-high']).toContain(result.riskLevel);
      expect(result.creditScore).toBeGreaterThanOrEqual(0);
      expect(result.creditScore).toBeLessThanOrEqual(100);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('should throw error for invalid input', async () => {
      await expect(provider.score(null as any)).rejects.toThrow(AIProviderError);
      await expect(provider.score({})).rejects.toThrow(AIProviderError);
      await expect(provider.score(undefined as any)).rejects.toThrow(AIProviderError);
    });

    it('should handle unconfigured provider', async () => {
      provider.setConfigured(false);
      await expect(provider.score({ userId: '123' }))
        .rejects.toThrow('INVALID_CONFIGURATION');
    });
  });

  describe('Provider Substitutability', () => {
    it('should maintain consistent interface across providers', async () => {
      const providers: IAIProvider[] = [provider];
      
      for (const prov of providers) {
        // All providers should have the same interface
        expect(typeof prov.score).toBe('function');
        expect(typeof prov.getName).toBe('function');
        expect(typeof prov.isHealthy).toBe('function');
        expect(typeof prov.getCapabilities).toBe('function');
        expect(typeof prov.isConfigured).toBe('function');
        
        // All should behave consistently
        expect(prov.getName()).toBeDefined();
        expect(typeof await prov.isHealthy()).toBe('boolean');
        expect(prov.getCapabilities()).toBeDefined();
        expect(typeof prov.isConfigured()).toBe('boolean');
      }
    });

    it('should preserve behavioral contracts', async () => {
      const userData = { userId: '123', income: 50000 };
      
      // Test that all providers follow the same behavioral contract
      const result = await provider.score(userData);
      
      expect(result.creditScore).toBeGreaterThanOrEqual(0);
      expect(result.creditScore).toBeLessThanOrEqual(100);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high', 'very-high']).toContain(result.riskLevel);
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      // Simulate rate limit scenario
      const userData = { userId: '123', income: 50000 };
      
      // This should work normally
      await expect(provider.score(userData)).resolves.toBeDefined();
    });

    it('should handle service unavailability', async () => {
      provider.setHealthy(false);
      const userData = { userId: '123', income: 50000 };
      
      await expect(provider.score(userData)).rejects.toThrow(AIProviderError);
    });

    it('should provide meaningful error messages', async () => {
      try {
        await provider.score({} as any);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AIProviderError);
        if (error instanceof AIProviderError) {
          expect(error.message).toContain('User data');
          expect(error.code).toBe('INVALID_INPUT');
        }
      }
    });
  });

  describe('Performance Contract', () => {
    it('should meet performance expectations', async () => {
      const userData = { userId: '123', income: 50000, debt: 10000 };
      
      const startTime = Date.now();
      await provider.score(userData);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Should be less than max latency
    });

    it('should handle concurrent requests', async () => {
      const userData = { userId: '123', income: 50000 };
      const promises = Array(5).fill(null).map(() => provider.score(userData));
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.provider).toBe(AIProvider.OPENAI);
        expect(result.creditScore).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Cost Estimation', () => {
    it('should provide cost estimates', async () => {
      const userData = { userId: '123', income: 50000 };
      const cost = await provider.estimateCost(userData);
      
      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Connection Testing', () => {
    it('should test provider connection', async () => {
      const isConnected = await provider.testConnection();
      expect(typeof isConnected).toBe('boolean');
      expect(isConnected).toBe(true);
    });

    it('should handle connection failures', async () => {
      provider.setHealthy(false);
      const isConnected = await provider.testConnection();
      expect(isConnected).toBe(false);
    });
  });
});