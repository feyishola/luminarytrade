import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndexerService } from './indexer.service';
import { Agent } from './entities/agent.entity';
import { NotFoundException } from '@nestjs/common';
import { SortOrder } from './dto/search-agent.dto';
import { CacheManager } from '../cache/cache-manager.service';
import { CacheInvalidator } from '../cache/cache-invalidator.service';

describe('IndexerService', () => {
  let service: IndexerService;
  let repository: Repository<Agent>;

  const mockAgent: Partial<Agent> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'TestAgent',
    description: 'A test agent',
    capabilities: ['chat', 'analyze'],
    evolution_level: 2,
    metadata: { version: '1.0' },
    performance_metrics: { success_rate: 95.5 },
    is_active: true,
  };

  let queryBuilder: any;
  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
    reset: jest.fn(),
    getOrSet: jest.fn(),
    warm: jest.fn(),
  };

  const mockCacheInvalidator = {
    invalidate: jest.fn(),
    invalidateKeys: jest.fn(),
    invalidateKey: jest.fn(),
    invalidatePattern: jest.fn(),
  };

  beforeEach(async () => {
    queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
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
      ],
    }).compile();

    service = module.get<IndexerService>(IndexerService);
    repository = module.get<Repository<Agent>>(getRepositoryToken(Agent));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new agent', async () => {
      const createDto = { name: 'TestAgent', capabilities: ['chat'] };
      mockRepository.create.mockReturnValue(mockAgent);
      mockRepository.save.mockResolvedValue(mockAgent);

      const result = await service.create(createDto);

      expect(result).toEqual(mockAgent);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockAgent);
    });
  });

  describe('search', () => {
    it('should return paginated agents', async () => {
      const searchDto = { page: 1, limit: 10, sort_by: 'created_at', order: SortOrder.DESC };
      const mockData = [mockAgent];
      const mockTotal = 1;

      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getManyAndCount.mockResolvedValue([mockData, mockTotal]);

      const result = await service.search(searchDto);

      expect(result.data).toEqual(mockData);
      expect(result.meta.total).toBe(mockTotal);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total_pages).toBe(1);
    });

    it('should filter by capabilities', async () => {
      const searchDto = {
        capabilities: ['chat'],
        page: 1,
        limit: 10,
        sort_by: 'created_at',
        order: SortOrder.DESC,
      };

      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getManyAndCount.mockResolvedValue([[mockAgent], 1]);

      await service.search(searchDto);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'agent.capabilities @> :capabilities',
        { capabilities: JSON.stringify(['chat']) },
      );
    });
  });

  describe('findOne', () => {
    it('should return an agent by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockAgent);

      const result = await service.findOne('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockAgent);
    });

    it('should throw NotFoundException if agent not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePerformanceMetrics', () => {
    it('should update agent performance metrics', async () => {
      const metrics = { success_rate: 98.0 };
      mockRepository.findOne.mockResolvedValue(mockAgent);
      mockRepository.save.mockResolvedValue({ ...mockAgent, performance_metrics: metrics });

      const result = await service.updatePerformanceMetrics(mockAgent.id, metrics);

      expect(result.performance_metrics).toEqual(metrics);
    });
  });
});
