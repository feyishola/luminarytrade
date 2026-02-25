# Adapter Pattern Documentation

## Overview

The adapter pattern abstraction layer enables seamless integration with external services while maintaining loose coupling between business logic and external provider implementations. This architecture allows for easy provider switching, fallback strategies, and comprehensive testing.

## Architecture

### Core Interfaces

#### 1. **IAdapter** (Base Interface)
All adapters implement the base `IAdapter` interface, providing:
- `getName()`: Get unique identifier
- `isConfigured()`: Check if properly configured
- `isHealthy()`: Perform health check
- `getMetadata()`: Get adapter capabilities and metadata

```typescript
export interface IAdapter {
  getName(): string;
  isConfigured(): boolean;
  isHealthy(): Promise<boolean>;
  getMetadata(): AdapterMetadata;
}
```

#### 2. **IWalletAdapter** (Wallet Operations)
Handles wallet-specific operations:
- `verifySignature()`: Verify message signatures
- `validateAddress()`: Validate wallet address format
- `getWalletInfo()`: Retrieve wallet information
- `getNetwork()`: Get connected network

```typescript
export interface IWalletAdapter extends IAdapter {
  verifySignature(publicKey: string, message: string, signature: string): Promise<boolean>;
  validateAddress(publicKey: string): boolean;
  getWalletInfo(publicKey: string): Promise<WalletInfo>;
  getNetwork(): string;
}
```

#### 3. **IAIModelAdapter** (AI Provider Operations)
Abstracts AI provider interactions:
- `score()`: Execute scoring operation
- `getCapabilities()`: Get provider capabilities
- `estimateCost()`: Optional cost estimation
- `testConnection()`: Test provider connectivity

```typescript
export interface IAIModelAdapter extends IAdapter {
  score(userData: Record<string, any>): Promise<NormalizedScoringResult>;
  getCapabilities(): AIProviderCapabilities;
  estimateCost?(userData: Record<string, any>): Promise<number>;
  testConnection(): Promise<boolean>;
}
```

## Creating New Adapters

### Creating a Wallet Adapter

1. **Implement IWalletAdapter**

```typescript
import { IWalletAdapter, WalletInfo } from '../interfaces/wallet-adapter.interface';
import { AdapterMetadata } from '../interfaces/base-adapter.interface';

export class CustomWalletAdapter implements IWalletAdapter {
  constructor(private config?: AdapterConfig) {}

  getName(): string {
    return 'custom-wallet';
  }

  isConfigured(): boolean {
    return true; // Verify your provider is ready
  }

  async isHealthy(): Promise<boolean> {
    // Implement health check logic
    try {
      // Test your provider connection
      return true;
    } catch {
      return false;
    }
  }

  getMetadata(): AdapterMetadata {
    return {
      name: 'Custom Wallet Adapter',
      version: '1.0.0',
      provider: 'custom',
      capabilities: ['signature-verification', 'address-validation'],
      isAsync: true,
      supportsRetry: true,
      supportsCircuitBreaker: true,
    };
  }

  async verifySignature(
    publicKey: string,
    message: string,
    signature: string,
  ): Promise<boolean> {
    // Implement signature verification
    return true;
  }

  validateAddress(publicKey: string): boolean {
    // Implement address validation
    return true;
  }

  async getWalletInfo(publicKey: string): Promise<WalletInfo> {
    // Implement wallet info retrieval
    return {
      address: publicKey,
      isActive: true,
      lastUpdated: new Date(),
    };
  }

  getNetwork(): string {
    return 'mainnet';
  }
}
```

2. **Register in AdaptersModule**

```typescript
export class AdaptersModule {
  constructor(private registry: AdapterRegistry) {
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    const customAdapter = new CustomWalletAdapter();
    this.registry.registerWalletAdapter(customAdapter, false);
  }
}
```

### Creating an AI Provider Adapter

1. **Extend BaseAIModelAdapter**

```typescript
import { BaseAIModelAdapter } from './base-ai-model.adapter';
import { NormalizedScoringResult, AIProviderCapabilities, AIProvider } from '../interfaces/ai-model-adapter.interface';

export class CustomAIAdapter extends BaseAIModelAdapter {
  private apiKey: string;

  constructor(apiKey: string) {
    super(AIProvider.CUSTOM); // Use your provider name
    this.apiKey = apiKey;
  }

  isApiKeyConfigured(): boolean {
    return !!this.apiKey;
  }

  async score(userData: Record<string, any>): Promise<NormalizedScoringResult> {
    return this.withRetry(async () => {
      // Call your AI provider API
      const result = await this.callProviderAPI(userData);

      return {
        provider: this.providerName,
        creditScore: this.normalizeScore(result.score, 0, 100),
        riskScore: result.riskScore,
        riskLevel: this.calculateRiskLevel(result.riskScore),
        rawResponse: result,
      };
    }, 'Custom AI scoring');
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test connection to your AI provider
      return await this.testConnection();
    } catch {
      return false;
    }
  }

  getCapabilities(): AIProviderCapabilities {
    return {
      supportsCreditScoring: true,
      supportsRiskAnalysis: true,
      supportsRealTimeProcessing: true,
      maxRequestSize: 5000,
      averageResponseTime: 2000,
      costPerRequest: 0.05,
    };
  }

  private async callProviderAPI(userData: Record<string, any>): Promise<any> {
    // Implement API calls here
  }
}
```

2. **Register in AdaptersModule**

```typescript
private initializeAdapters(): void {
  const customAIAdapter = new CustomAIAdapter(apiKey);
  this.registry.registerAIAdapter(customAIAdapter);
}
```

## Using Adapters in Services

### Example: Using Wallet Adapter in Auth Service

```typescript
import { AdapterFactory } from '../adapters/factory/adapter.factory';

@Injectable()
export class AuthService {
  constructor(private adapterFactory: AdapterFactory) {}

  async validateWallet(loginDto: LoginDto) {
    const isValid = await this.adapterFactory.executeWalletOperationWithProtection(
      async (walletAdapter) => {
        // Validate address
        if (!walletAdapter.validateAddress(loginDto.publicKey)) {
          throw new Error('Invalid address');
        }

        // Verify signature
        return await walletAdapter.verifySignature(
          loginDto.publicKey,
          loginDto.message,
          loginDto.signature,
        );
      },
    );

    return isValid;
  }
}
```

### Example: Using AI Adapter in Orchestration Service

```typescript
import { AdapterFactory } from '../adapters/factory/adapter.factory';

@Injectable()
export class AIOrchestrationService {
  constructor(private adapterFactory: AdapterFactory) {}

  async scoreUser(userData: Record<string, any>) {
    const result = await this.adapterFactory.executeAIOperationWithFallback(
      async (adapter) => {
        return await adapter.score(userData);
      },
      'preferred-provider', // Optional: specify preferred provider
    );

    return result;
  }
}
```

## Advanced Features

### 1. Circuit Breaker Pattern

Prevents cascading failures when a provider is down:

```typescript
import { CircuitBreaker } from '../adapters/patterns/circuit-breaker';

const breaker = new CircuitBreaker(
  'provider-name',
  5,    // Failure threshold
  60000, // Reset timeout (ms)
  2,    // Success threshold for recovery
);

try {
  await breaker.execute(async () => {
    // Your operation here
  });
} catch (error) {
  // Handler circuit breaker errors
}
```

### 2. Fallback Handler Pattern

Automatically tries alternative providers on failure:

```typescript
import { FallbackHandler } from '../adapters/patterns/fallback-handler';

const handler = new FallbackHandler('operation-name');

const result = await handler.executeWithFallback(
  [adapter1, adapter2, adapter3],
  async (adapter) => {
    return await adapter.score(userData);
  },
);
```

### 3. Adapter Registry

Centralized adapter management:

```typescript
import { AdapterRegistry } from '../adapters/registry/adapter.registry';

@Injectable()
export class MyService {
  constructor(private registry: AdapterRegistry) {}

  async execute() {
    // Get all healthy AI adapters
    const healthyAdapters = await this.registry.getHealthyAIAdapters();

    // Get all adapters
    const allAdapters = this.registry.getAllAIAdapters();

    // Get specific adapter
    const adapter = this.registry.getAIAdapter('openai');

    // Check health
    const health = await this.registry.getAdapterHealth();
  }
}
```

## Testing with Mock Adapters

### MockWalletAdapter

```typescript
import { MockWalletAdapter } from '../adapters/mocks/mock-wallet.adapter';

describe('Auth Service', () => {
  let authService: AuthService;
  let walletAdapter: MockWalletAdapter;

  beforeEach(() => {
    walletAdapter = new MockWalletAdapter();
    walletAdapter.addValidAddress('GTEST123...');
    walletAdapter.addValidSignature('test-sig', 'test-message', true);

    // Register mock adapter
    registry.registerWalletAdapter(walletAdapter);
  });

  it('should verify wallet signature', async () => {
    const result = await authService.validateWallet({
      publicKey: 'GTEST123...',
      message: 'test-message',
      signature: 'test-sig',
    });

    expect(result).toBe(true);
  });
});
```

### MockAIAdapter

```typescript
import { MockAIAdapter } from '../adapters/mocks/mock-ai.adapter';

describe('AI Orchestration Service', () => {
  let service: AIOrchestrationService;
  let aiAdapter: MockAIAdapter;

  beforeEach(() => {
    aiAdapter = new MockAIAdapter(AIProvider.OPENAI);
    aiAdapter.setDefaultMockResult(750, 30, 'low');

    registry.registerAIAdapter(aiAdapter);
  });

  it('should score user data', async () => {
    const result = await service.scoreUser({
      email: 'test@example.com',
    });

    expect(result.creditScore).toBe(750);
    expect(result.riskLevel).toBe('low');
  });

  it('should handle adapter failure', async () => {
    aiAdapter.setFailure(true);

    expect(async () => {
      await service.scoreUser({ email: 'test@example.com' });
    }).rejects.toThrow();
  });
});
```

## Extension Points

### 1. Custom Health Checks

Extend `BaseAIModelAdapter` to implement custom health checks:

```typescript
async isHealthy(): Promise<boolean> {
  try {
    // Custom health check logic
    const response = await this.client.get('/health');
    return response.status === 200;
  } catch {
    return false;
  }
}
```

### 2. Retry Logic

The base adapters include retry logic with exponential backoff:

```typescript
protected async withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'operation',
): Promise<T> {
  // Retry logic implemented here
}
```

### 3. Cost Estimation

Implement optional cost estimation for AI adapters:

```typescript
async estimateCost(userData: Record<string, any>): Promise<number> {
  const inputTokens = this.countTokens(userData);
  return (inputTokens / 1000) * this.costPerThousandTokens;
}
```

## Migration Guide

### From Direct SDK Usage to Adapter Pattern

**Before:**
```typescript
import { Keypair } from '@stellar/stellar-sdk';

async validateWallet(publicKey: string, message: string, signature: string) {
  const keypair = Keypair.fromPublicKey(publicKey);
  return keypair.verify(Buffer.from(message), Buffer.from(signature, 'base64'));
}
```

**After:**
```typescript
async validateWallet(publicKey: string, message: string, signature: string) {
  return this.adapterFactory.executeWalletOperationWithProtection(
    async (adapter) => adapter.verifySignature(publicKey, message, signature)
  );
}
```

## Benefits

1. **Loose Coupling**: Services depend on abstractions, not implementations
2. **Easy Testing**: Mock adapters for comprehensive testing
3. **Provider Flexibility**: Switch providers without changing service code
4. **Resilience**: Built-in circuit breaker and fallback patterns
5. **Monitoring**: Health checks and metrics for all adapters
6. **Extensibility**: Add new providers without modifying existing code

## Best Practices

1. Always implement proper error handling in adapters
2. Use health checks to monitor provider availability
3. Test adapter switching with integration tests
4. Document adapter-specific configuration requirements
5. Use fallback adapters for critical operations
6. Monitor circuit breaker statistics
7. Implement timeouts for all external calls
8. Log adapter operations for debugging

## Configuration

Adapters can be configured via environment variables:

```
# Wallet Configuration
STELLAR_NETWORK=testnet

# AI Provider Configuration
OPENAI_API_KEY=sk-...
LLAMA_API_KEY=...
GROK_API_KEY=...

# Adapter Configuration
ADAPTER_TIMEOUT=30000
ADAPTER_MAX_RETRIES=3
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT=60000
```

## Troubleshooting

### Adapter Not Registered
- Ensure adapter is registered in `AdaptersModule`
- Check adapter `isConfigured()` returns true

### Health Check Failures
- Verify provider credentials are correct
- Check network connectivity
- Ensure provider API is available

### Circuit Breaker Open
- Review error logs for provider failures
- Check provider health status
- Wait for reset timeout before retrying

---

For more information, see the adapter interfaces and implementation files.
