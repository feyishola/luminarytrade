import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheManager } from './cache-manager.service';
import { CacheMetricsService } from './cache-metrics.service';

describe('CacheManager', () => {
  let service: CacheManager;
  let mockCacheManager: any;
  let metricsService: CacheMetricsService;

  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
      store: {
        keys: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheManager,
        CacheMetricsService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheManager>(CacheManager);
    metricsService = module.get<CacheMetricsService>(CacheMetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateKey', () => {
    it('should generate key without namespace', () => {
      const key = service.generateKey('test-key');
      expect(key).toBe('test-key');
    });

    it('should generate key with namespace', () => {
      const key = service.generateKey('test-key', 'agent');
      expect(key).toBe('agent:test-key');
    });
  });

  describe('get', () => {
    it('should return cached value and record hit', async () => {
      const testValue = { data: 'test' };
      mockCacheManager.get.mockResolvedValue(testValue);

      const result = await service.get('test-key');

      expect(result).toEqual(testValue);
      expect(mockCacheManager.get).toHaveBeenCalledWith('test-key');
      expect(metricsService.getMetrics().hits).toBe(1);
    });

    it('should return undefined and record miss when not cached', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.get('test-key');

      expect(result).toBeUndefined();
      expect(metricsService.getMetrics().misses).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

      const result = await service.get('test-key');

      expect(result).toBeUndefined();
      expect(metricsService.getMetrics().misses).toBe(1);
    });
  });

  describe('set', () => {
    it('should set value in cache', async () => {
      const testValue = { data: 'test' };

      await service.set('test-key', testValue);

      expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', testValue, undefined);
    });

    it('should set value with TTL', async () => {
      const testValue = { data: 'test' };

      await service.set('test-key', testValue, { ttl: 60 });

      expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', testValue, 60000);
    });

    it('should set value with namespace', async () => {
      const testValue = { data: 'test' };

      await service.set('test-key', testValue, { namespace: 'agent' });

      expect(mockCacheManager.set).toHaveBeenCalledWith('agent:test-key', testValue, undefined);
    });
  });

  describe('del', () => {
    it('should delete value from cache', async () => {
      await service.del('test-key');

      expect(mockCacheManager.del).toHaveBeenCalledWith('test-key');
    });

    it('should delete value with namespace', async () => {
      await service.del('test-key', { namespace: 'agent' });

      expect(mockCacheManager.del).toHaveBeenCalledWith('agent:test-key');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedValue = { data: 'cached' };
      mockCacheManager.get.mockResolvedValue(cachedValue);

      const factory = jest.fn();
      const result = await service.getOrSet('test-key', factory);

      expect(result).toEqual(cachedValue);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should execute factory and cache result if not cached', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      const factoryValue = { data: 'new' };
      const factory = jest.fn().mockResolvedValue(factoryValue);

      const result = await service.getOrSet('test-key', factory);

      expect(result).toEqual(factoryValue);
      expect(factory).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', factoryValue, undefined);
    });
  });

  describe('reset', () => {
    it('should clear all cache', async () => {
      await service.reset();

      expect(mockCacheManager.reset).toHaveBeenCalled();
    });
  });
});
