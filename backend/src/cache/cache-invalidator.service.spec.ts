import { Test, TestingModule } from '@nestjs/testing';
import { CacheInvalidator } from './cache-invalidator.service';
import { CacheManager } from './cache-manager.service';

describe('CacheInvalidator', () => {
  let service: CacheInvalidator;
  let mockCacheManager: any;

  beforeEach(async () => {
    mockCacheManager = {
      del: jest.fn(),
      delPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidator,
        {
          provide: CacheManager,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheInvalidator>(CacheInvalidator);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidate', () => {
    it('should invalidate cache by rule', async () => {
      await service.invalidate('agent:create');

      expect(mockCacheManager.delPattern).toHaveBeenCalledWith('agent:agents:*');
      expect(mockCacheManager.delPattern).toHaveBeenCalledWith('agent:agent:top-performers:*');
    });

    it('should handle unknown rule gracefully', async () => {
      await service.invalidate('unknown-rule');

      expect(mockCacheManager.delPattern).not.toHaveBeenCalled();
    });
  });

  describe('invalidateKey', () => {
    it('should invalidate specific key', async () => {
      await service.invalidateKey('test-key');

      expect(mockCacheManager.del).toHaveBeenCalledWith('test-key', {});
    });

    it('should invalidate key with namespace', async () => {
      await service.invalidateKey('test-key', 'agent');

      expect(mockCacheManager.del).toHaveBeenCalledWith('test-key', { namespace: 'agent' });
    });
  });

  describe('invalidateKeys', () => {
    it('should invalidate multiple keys', async () => {
      await service.invalidateKeys(['key1', 'key2', 'key3']);

      expect(mockCacheManager.del).toHaveBeenCalledTimes(3);
      expect(mockCacheManager.del).toHaveBeenCalledWith('key1', {});
      expect(mockCacheManager.del).toHaveBeenCalledWith('key2', {});
      expect(mockCacheManager.del).toHaveBeenCalledWith('key3', {});
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate by pattern', async () => {
      await service.invalidatePattern('agents:*');

      expect(mockCacheManager.delPattern).toHaveBeenCalledWith('agents:*');
    });

    it('should invalidate by pattern with namespace', async () => {
      await service.invalidatePattern('agents:*', 'agent');

      expect(mockCacheManager.delPattern).toHaveBeenCalledWith('agent:agents:*');
    });
  });
});
