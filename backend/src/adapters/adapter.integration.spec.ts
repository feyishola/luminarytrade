import { Test, TestingModule } from '@nestjs/testing';
import { AdapterRegistry } from './registry/adapter.registry';
import { AdapterFactory } from './factory/adapter.factory';
import { StellarWalletAdapter } from './wallet/stellar-wallet.adapter';
import { MockWalletAdapter } from './mocks/mock-wallet.adapter';
import { MockAIAdapter } from './mocks/mock-ai.adapter';
import { AIProvider } from './interfaces/ai-model-adapter.interface';
import { WalletProvider } from './interfaces/wallet-adapter.interface';
import { CircuitBreaker } from './patterns/circuit-breaker';
import { FallbackHandler } from './patterns/fallback-handler';

describe('Adapter Pattern Integration Tests', () => {
  let registry: AdapterRegistry;
  let factory: AdapterFactory;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [AdapterRegistry, AdapterFactory],
    }).compile();

    registry = module.get<AdapterRegistry>(AdapterRegistry);
    factory = module.get<AdapterFactory>(AdapterFactory);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Wallet Adapter Integration', () => {
    it('should register and retrieve wallet adapter', () => {
      const walletAdapter = new MockWalletAdapter();
      registry.registerWalletAdapter(walletAdapter);

      const retrieved = registry.getWalletAdapter(WalletProvider.STELLAR);
      expect(retrieved).toBeDefined();
      expect(retrieved?.getName()).toBe(WalletProvider.STELLAR);
    });

    it('should verify wallet signature through adapter', async () => {
      const walletAdapter = new MockWalletAdapter();
      walletAdapter.addValidSignature('test-sig', 'test-message', true);

      registry.registerWalletAdapter(walletAdapter);

      const adapter = registry.getWalletAdapter(WalletProvider.STELLAR);
      const isValid = await adapter!.verifySignature(
        'GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IYJJX2VY2YLGRZSXBJJMA',
        'test-message',
        'test-sig',
      );

      expect(isValid).toBe(true);
    });

    it('should validate wallet address', () => {
      const walletAdapter = new MockWalletAdapter();
      registry.registerWalletAdapter(walletAdapter);

      const adapter = registry.getWalletAdapter(WalletProvider.STELLAR);
      const isValid = adapter!.validateAddress(
        'GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IYJJX2VY2YLGRZSXBJJMA',
      );

      expect(isValid).toBe(true);
    });

    it('should invalidate wrong wallet address', () => {
      const walletAdapter = new MockWalletAdapter();
      registry.registerWalletAdapter(walletAdapter);

      const adapter = registry.getWalletAdapter(WalletProvider.STELLAR);
      const isValid = adapter!.validateAddress('INVALID_ADDRESS');

      expect(isValid).toBe(false);
    });
  });

  describe('AI Adapter Integration', () => {
    it('should register and retrieve AI adapter', () => {
      const aiAdapter = new MockAIAdapter(AIProvider.OPENAI);
      registry.registerAIAdapter(aiAdapter);

      const retrieved = registry.getAIAdapter(AIProvider.OPENAI);
      expect(retrieved).toBeDefined();
      expect(retrieved?.getName()).toBe(AIProvider.OPENAI);
    });

    it('should score user data through adapter', async () => {
      const aiAdapter = new MockAIAdapter(AIProvider.OPENAI);
      registry.registerAIAdapter(aiAdapter);

      const adapter = registry.getAIAdapter(AIProvider.OPENAI);
      const result = await adapter!.score({ email: 'test@example.com' });

      expect(result).toBeDefined();
      expect(result.creditScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeGreaterThan(-1);
      expect(['low', 'medium', 'high', 'very-high']).toContain(
        result.riskLevel,
      );
    });

    it('should get AI adapter capabilities', () => {
      const aiAdapter = new MockAIAdapter(AIProvider.LLAMA);
      registry.registerAIAdapter(aiAdapter);

      const adapter = registry.getAIAdapter(AIProvider.LLAMA);
      const capabilities = adapter!.getCapabilities();

      expect(capabilities.supportsCreditScoring).toBe(true);
      expect(capabilities.supportsRiskAnalysis).toBe(true);
      expect(capabilities.maxRequestSize).toBeGreaterThan(0);
    });
  });

  describe('Adapter Registry Health Checks', () => {
    it('should check health of all registered adapters', async () => {
      const walletAdapter = new MockWalletAdapter();
      const aiAdapter = new MockAIAdapter(AIProvider.OPENAI);

      registry.registerWalletAdapter(walletAdapter);
      registry.registerAIAdapter(aiAdapter);

      const health = await registry.getAdapterHealth();

      expect(health).toBeDefined();
      expect(health.wallet[WalletProvider.STELLAR]).toBe(true);
      expect(health.ai[AIProvider.OPENAI]).toBe(true);
    });

    it('should return unhealthy status when adapter fails', async () => {
      const aiAdapter = new MockAIAdapter(AIProvider.OPENAI);
      aiAdapter.setFailure(true);

      registry.registerAIAdapter(aiAdapter);

      const health = await registry.getAdapterHealth();
      expect(health.ai[AIProvider.OPENAI]).toBe(false);
    });
  });

  describe('Adapter Factory with Circuit Breaker', () => {
    it('should execute operation with circuit breaker protection', async () => {
      const walletAdapter = new MockWalletAdapter();
      registry.registerWalletAdapter(walletAdapter);

      const result = await factory.executeWalletOperationWithProtection(
        async (adapter) => {
          return await adapter.getWalletInfo(
            'GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IYJJX2VY2YLGRZSXBJJMA',
          );
        },
      );

      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
    });

    it('should execute AI operation with fallback', async () => {
      const openaiAdapter = new MockAIAdapter(AIProvider.OPENAI);
      const llamaAdapter = new MockAIAdapter(AIProvider.LLAMA);

      registry.registerAIAdapter(openaiAdapter, true);
      registry.registerAIAdapter(llamaAdapter);

      const result = await factory.executeAIOperationWithFallback(
        async (adapter) => {
          return await adapter.score({ email: 'test@example.com' });
        },
      );

      expect(result).toBeDefined();
      expect(result.creditScore).toBeGreaterThan(0);
    });

    it('should fallback to next adapter when primary fails', async () => {
      const openaiAdapter = new MockAIAdapter(AIProvider.OPENAI);
      const llamaAdapter = new MockAIAdapter(AIProvider.LLAMA);

      openaiAdapter.setFailure(true); // Primary fails
      llamaAdapter.setDefaultMockResult(700, 40, 'low');

      registry.registerAIAdapter(openaiAdapter, true);
      registry.registerAIAdapter(llamaAdapter);

      const result = await factory.executeAIOperationWithFallback(
        async (adapter) => {
          return await adapter.score({ email: 'test@example.com' });
        },
        AIProvider.OPENAI,
      );

      expect(result).toBeDefined();
      expect(result.provider).toBe(AIProvider.LLAMA);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should transition circuit breaker to OPEN after failures', async () => {
      const breaker = new CircuitBreaker('test', 2, 1000, 1); // 2 failures to open

      let failCount = 0;
      const failingOperation = async () => {
        failCount++;
        throw new Error('Operation failed');
      };

      // First two calls fail, opening the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');
    });

    it('should fail fast when circuit is OPEN', async () => {
      const breaker = new CircuitBreaker('test', 1, 1000, 1);

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error('Failed');
        });
      } catch {
        // Expected
      }

      // Next call should fail immediately
      expect(async () => {
        await breaker.execute(async () => {
          return 'success';
        });
      }).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = new CircuitBreaker('test', 1, 100, 1); // 100ms reset timeout

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error('Failed');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('OPEN');

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next call should attempt HALF_OPEN
      const result = await breaker.execute(async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('Fallback Handler Pattern', () => {
    it('should try adapters in order until success', async () => {
      const handlers = new FallbackHandler('test');

      const adapter1 = new MockAIAdapter(AIProvider.OPENAI);
      const adapter2 = new MockAIAdapter(AIProvider.LLAMA);

      adapter1.setFailure(true); // First fails
      adapter2.setDefaultMockResult(750, 30, 'low'); // Second succeeds

      const result = await handlers.executeWithFallback(
        [adapter1, adapter2],
        async (adapter) => {
          return await adapter.score({ email: 'test@example.com' });
        },
      );

      expect(result.provider).toBe(AIProvider.LLAMA);
    });

    it('should throw when all adapters fail', async () => {
      const handlers = new FallbackHandler('test');

      const adapter1 = new MockAIAdapter(AIProvider.OPENAI);
      const adapter2 = new MockAIAdapter(AIProvider.LLAMA);

      adapter1.setFailure(true);
      adapter2.setFailure(true);

      expect(async () => {
        await handlers.executeWithFallback(
          [adapter1, adapter2],
          async (adapter) => {
            return await adapter.score({ email: 'test@example.com' });
          },
        );
      }).rejects.toThrow();
    });
  });

  describe('Multiple Adapter Registration', () => {
    it('should register multiple adapters of same type', () => {
      const adapter1 = new MockAIAdapter(AIProvider.OPENAI);
      const adapter2 = new MockAIAdapter(AIProvider.LLAMA);
      const adapter3 = new MockAIAdapter(AIProvider.GROK);

      registry.registerAIAdapter(adapter1, true);
      registry.registerAIAdapter(adapter2);
      registry.registerAIAdapter(adapter3);

      const allAdapters = registry.getAllAIAdapters();
      expect(allAdapters.length).toBe(3);
    });

    it('should get all healthy adapters', async () => {
      const adapter1 = new MockAIAdapter(AIProvider.OPENAI);
      const adapter2 = new MockAIAdapter(AIProvider.LLAMA);

      adapter2.setFailure(true);

      registry.registerAIAdapter(adapter1);
      registry.registerAIAdapter(adapter2);

      const healthyAdapters = await registry.getHealthyAIAdapters();
      expect(healthyAdapters.length).toBe(1);
      expect(healthyAdapters[0].getName()).toBe(AIProvider.OPENAI);
    });
  });

  describe('Adapter Switching', () => {
    it('should switch default adapter', () => {
      const adapter1 = new MockAIAdapter(AIProvider.OPENAI);
      const adapter2 = new MockAIAdapter(AIProvider.LLAMA);

      registry.registerAIAdapter(adapter1, true); // Set as default
      registry.registerAIAdapter(adapter2);

      let current = registry.getAIAdapter();
      expect(current?.getName()).toBe(AIProvider.OPENAI);

      // Switch default
      registry.setDefaultAIAdapter(AIProvider.LLAMA);
      current = registry.getAIAdapter();
      expect(current?.getName()).toBe(AIProvider.LLAMA);
    });

    it('should unregister adapter', () => {
      const adapter = new MockAIAdapter(AIProvider.OPENAI);
      registry.registerAIAdapter(adapter);

      expect(registry.getAIAdapter(AIProvider.OPENAI)).toBeDefined();

      registry.unregisterAIAdapter(AIProvider.OPENAI);
      expect(registry.getAIAdapter(AIProvider.OPENAI)).toBeNull();
    });
  });
});
