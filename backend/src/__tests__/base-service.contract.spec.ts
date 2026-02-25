import { Test, TestingModule } from '@nestjs/testing';
import { IBaseService, ServiceMetadata } from '../../common/services/base-service.interface';
import { BaseService } from '../../common/services/base.service';

/**
 * Mock service implementation for testing
 */
class MockService extends BaseService implements IBaseService {
  private configured: boolean = true;
  private healthy: boolean = true;

  constructor() {
    super('MockService');
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async isHealthy(): Promise<boolean> {
    return this.healthy;
  }

  setConfigured(configured: boolean): void {
    this.configured = configured;
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  // Test method with contract
  async processData(data: any): Promise<any> {
    if (!data) {
      throw new Error('Data is required');
    }
    return { processed: true, data };
  }
}

/**
 * Behavioral specification tests for BaseService contract
 * Ensures LSP compliance across all service implementations
 */
describe('BaseService Contract Specification', () => {
  let service: MockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockService],
    }).compile();

    service = module.get<MockService>(MockService);
  });

  describe('Service Contract Compliance', () => {
    it('should implement IBaseService interface', () => {
      expect(service).toBeDefined();
      expect(typeof service.getName).toBe('function');
      expect(typeof service.isConfigured).toBe('function');
      expect(typeof service.isHealthy).toBe('function');
      expect(typeof service.getMetadata).toBe('function');
    });

    it('should return correct service name', () => {
      expect(service.getName()).toBe('MockService');
    });

    it('should return service metadata', () => {
      const metadata = service.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('MockService');
      expect(metadata.version).toBe('1.0.0');
      expect(Array.isArray(metadata.capabilities)).toBe(true);
    });

    it('should validate configuration status', () => {
      expect(service.isConfigured()).toBe(true);
      service.setConfigured(false);
      expect(service.isConfigured()).toBe(false);
    });

    it('should check health status', async () => {
      expect(await service.isHealthy()).toBe(true);
      service.setHealthy(false);
      expect(await service.isHealthy()).toBe(false);
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize service correctly', async () => {
      await service.initialize({ maxRetries: 5 });
      // Service should be marked as initialized
      expect((service as any).isInitialized).toBe(true);
    });

    it('should handle double initialization gracefully', async () => {
      await service.initialize();
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should destroy service correctly', async () => {
      await service.initialize();
      await service.destroy();
      expect((service as any).isInitialized).toBe(false);
    });

    it('should handle destroy without initialization', async () => {
      await expect(service.destroy()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle retry logic', async () => {
      let attemptCount = 0;
      
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await (service as any).executeWithRetry(operation, 3);
      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should fail after max retries exceeded', async () => {
      const operation = async () => {
        throw new Error('Persistent failure');
      };

      await expect((service as any).executeWithRetry(operation, 2))
        .rejects.toThrow('Persistent failure');
    });
  });

  describe('Contract Validation', () => {
    it('should validate preconditions', () => {
      const preconditions = { 'data != null': true, 'data.isValid === true': false };
      expect(() => {
        (service as any).validatePreconditions({ 'data != null': true });
      }).not.toThrow();
      
      expect(() => {
        (service as any).validatePreconditions({ 'data != null': false });
      }).toThrow('Precondition failed: data != null');
    });

    it('should validate postconditions', () => {
      expect(() => {
        (service as any).validatePostconditions({ 'result != null': true });
      }).not.toThrow();
      
      expect(() => {
        (service as any).validatePostconditions({ 'result != null': false });
      }).toThrow('Postcondition failed: result != null');
    });
  });

  describe('Service Substitutability', () => {
    it('should maintain substitutability contract', async () => {
      // Test that any IBaseService implementation can be used interchangeably
      const services: IBaseService[] = [service];
      
      for (const svc of services) {
        expect(typeof svc.getName).toBe('function');
        expect(typeof svc.isConfigured).toBe('function');
        expect(typeof svc.isHealthy).toBe('function');
        expect(typeof svc.getMetadata).toBe('function');
        
        // All should behave consistently
        expect(svc.getName()).toBeDefined();
        expect(typeof svc.isConfigured()).toBe('boolean');
        expect(typeof await svc.isHealthy()).toBe('boolean');
        expect(svc.getMetadata()).toBeDefined();
      }
    });

    it('should preserve behavioral contracts', async () => {
      // Test that behavioral contracts are preserved across implementations
      const metadata = service.getMetadata();
      const expectedKeys: (keyof ServiceMetadata)[] = [
        'name', 'version', 'description', 'capabilities', 
        'dependencies', 'isAsync', 'supportsTransactions', 'errorHandlingStrategy'
      ];
      
      for (const key of expectedKeys) {
        expect(key in metadata).toBe(true);
      }
    });
  });
});