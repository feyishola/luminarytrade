import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndexerService } from './indexer.service';
import { Agent } from './entities/agent.entity';
import { CacheManager } from '../cache/cache-manager.service';
import { CacheInvalidator } from '../cache/cache-invalidator.service';
import { CacheMetricsService } from '../cache/cache-metrics.service';

describe('IndexerService - Caching', () => {
  let service: IndexerService;
  let repository: Repository<Agent>;
  let cacheManager: CacheManager;
  let cacheInvalidator: CacheInvalidator;
  let metricsService: CacheMetricsService;

  const mockAgent: Agent = {
    id: '123',
    name: 'Test Agent',
    description: 'Test Description',
    metadata: {},
    capabilities: ['test'],
    evolution_level: 1,
    performance_metrics: {
      total_tasks: 100,
      success_rate: 0.95,
      avg_response_time: 200,
      uptime_percentage: 99.5,
    },
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAgent]),
      })),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
      warm: jest.fn(),
    };

    const mockCacheInvalidator = {
      invalidate: jest.fn(),
      invalidateKey: jest.fn(),
      invalidateKeys: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        {
          provide: getRepositoryToken(Agent),
          useValue: mockRepository,
        },
        {
          provide: CacheManager,
          useValue: mockCacheManager,
        },
        {
          provide: CacheInvalidator,
          useValue: mockCacheInvalidator,
        },
        CacheMetricsService,
      ],
    }).compile();

    service = module.get<IndexerService>(IndexerService);
    repository = module.get<Repository<Agent>>(getRepositoryToken(Agent));
    cacheManager = module.get<CacheManager>(CacheManager);
    cacheInvalidator = module.get<CacheInvalidator>(CacheInvalidator);
    metricsService = module.get<CacheMetricsService>(CacheMetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTopPerformers - Caching', () => {
    it('should cache top performers result', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(null);

      const result = await service.getTopPerformers(10);

      expect(result).toEqual([mockAgent]);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'top-performers:10',
        [mockAgent],
        { ttl: 300, namespace: 'agent' }
      );
    });

    it('should return cached result on second call', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue([mockAgent]);

      const result = await service.getTopPerformers(10);

      expect(result).toEqual([mockAgent]);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findOne - Caching', () => {
    it('should cache agent by id', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      (repository.findOne as jest.Mock).mockResolvedValue(mockAgent);

      const result = await service.findOne('123');

      expect(result).toEqual(mockAgent);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'agent:123',
        mockAgent,
        { ttl: 600, namespace: 'agent' }
      );
    });

    it('should return cached agent on second call', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(mockAgent);

      const result = await service.findOne('123');

      expect(result).toEqual(mockAgent);
      expect(repository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('create - Cache Invalidation', () => {
    it('should invalidate cache after creating agent', async () => {
      const createDto = {
        name: 'New Agent',
        description: 'New Description',
      };

      (repository.create as jest.Mock).mockReturnValue(mockAgent);
      (repository.save as jest.Mock).mockResolvedValue(mockAgent);

      await service.create(createDto);

      expect(cacheInvalidator.invalidate).toHaveBeenCalledWith('agent:create');
    });
  });

  describe('updatePerformanceMetrics - Cache Invalidation', () => {
    it('should invalidate cache after updating metrics', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(mockAgent);
      (repository.save as jest.Mock).mockResolvedValue(mockAgent);

      const metrics = { success_rate: 0.98 };
      await service.updatePerformanceMetrics('123', metrics);

      expect(cacheInvalidator.invalidate).toHaveBeenCalledWith('agent:performance-update');
      expect(cacheInvalidator.invalidateKeys).toHaveBeenCalledWith(['agent:123'], undefined);
    });
  });

  describe('warmCache', () => {
    it('should warm cache for critical queries', async () => {
      await service.warmCache();

      expect(cacheManager.warm).toHaveBeenCalledWith(
        'top-performers:10',
        expect.any(Function),
        { ttl: 300, namespace: 'agent' }
      );
    });
  });
});
