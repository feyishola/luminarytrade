import { SpecificationExecutor } from '../core/specification-executor';
import { SpecificationCache } from '../cache/specification-cache';
import { SpecificationValidator } from '../validation/specification-validator';
import { ActiveAgentsSpec, HighScoreAgentsSpec, Agent } from '../domain/agents/agent.specifications';
import { TrustedWalletsSpec, Wallet } from '../domain/wallets/wallet.specifications';
import { Specification, QueryContext, SpecificationQuery } from '../core/specification.abstract';
import { PaginatedSpecification } from '../core/paginated-specification';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetMany = jest.fn().mockResolvedValue([]);
const mockGetOne = jest.fn().mockResolvedValue(null);
const mockGetCount = jest.fn().mockResolvedValue(0);
const mockGetManyAndCount = jest.fn().mockResolvedValue([[], 0]);
const mockAndWhere = jest.fn().mockReturnThis();
const mockLeftJoin = jest.fn().mockReturnThis();
const mockInnerJoin = jest.fn().mockReturnThis();
const mockSkip = jest.fn().mockReturnThis();
const mockTake = jest.fn().mockReturnThis();
const mockAddOrderBy = jest.fn().mockReturnThis();
const mockAddSelect = jest.fn().mockReturnThis();
const mockGetSql = jest.fn().mockReturnValue('SELECT agent FROM agent WHERE ...');

const mockQueryBuilder = {
  alias: 'agent',
  andWhere: mockAndWhere,
  leftJoin: mockLeftJoin,
  innerJoin: mockInnerJoin,
  skip: mockSkip,
  take: mockTake,
  addOrderBy: mockAddOrderBy,
  addSelect: mockAddSelect,
  getMany: mockGetMany,
  getOne: mockGetOne,
  getCount: mockGetCount,
  getManyAndCount: mockGetManyAndCount,
  getSql: mockGetSql,
  getParameters: jest.fn().mockReturnValue({}),
};

const mockRepository = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

const mockDataSource = {
  getRepository: jest.fn().mockReturnValue(mockRepository),
  query: jest.fn().mockResolvedValue([{ 'QUERY PLAN': 'Seq Scan...' }]),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('SpecificationExecutor', () => {
  let executor: SpecificationExecutor;
  let cache: SpecificationCache;
  let validator: SpecificationValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new SpecificationCache();
    validator = new SpecificationValidator();
    executor = new SpecificationExecutor(
      mockDataSource as any,
      cache,
      validator,
    );
  });

  describe('execute()', () => {
    it('should call repository.createQueryBuilder with entity alias', async () => {
      await executor.execute(new ActiveAgentsSpec(), Agent as any);
      expect(mockDataSource.getRepository).toHaveBeenCalledWith(Agent);
      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should apply WHERE clause from specification', async () => {
      await executor.execute(new ActiveAgentsSpec(), Agent as any);
      expect(mockAndWhere).toHaveBeenCalledWith(
        expect.stringContaining('isActive'),
        expect.objectContaining({ activeEntitiesIsActive: true }),
      );
    });

    it('should return results from getMany()', async () => {
      const mockAgents: Partial<Agent>[] = [{ id: '1', isActive: true }];
      mockGetMany.mockResolvedValueOnce(mockAgents);
      const result = await executor.execute(new ActiveAgentsSpec(), Agent as any);
      expect(result).toEqual(mockAgents);
    });

    it('should throw on invalid specification', async () => {
      jest.spyOn(validator, 'validate').mockReturnValueOnce({
        isValid: false,
        errors: ['Test error'],
        warnings: [],
        suggestions: [],
      });
      await expect(
        executor.execute(new ActiveAgentsSpec(), Agent as any),
      ).rejects.toThrow('Specification validation failed: Test error');
    });

    it('should use cache when cacheKey is provided', async () => {
      const cached: Agent[] = [{ id: 'cached', isActive: true } as Agent];
      await cache.set('spec:Agent:CachedKey', cached);

      const setSpy = jest.spyOn(cache, 'set');
      const result = await executor.execute(new ActiveAgentsSpec(), Agent as any, {
        cacheKey: 'spec:Agent:CachedKey',
      });

      expect(result).toEqual(cached);
      expect(mockGetMany).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('should cache results after first execution', async () => {
      const agents = [{ id: '1', isActive: true } as Agent];
      mockGetMany.mockResolvedValueOnce(agents);

      const setSpy = jest.spyOn(cache, 'set');
      await executor.execute(new ActiveAgentsSpec(), Agent as any, {
        cacheKey: 'my-key',
        cacheTtlMs: 5000,
      });

      expect(setSpy).toHaveBeenCalledWith('my-key', agents, 5000);
    });
  });

  describe('executePaginated()', () => {
    it('should return paginated metadata', async () => {
      const agents = [{ id: '1' } as Agent];
      mockGetManyAndCount.mockResolvedValueOnce([agents, 50]);

      const spec = new ActiveAgentsSpec().paginate(2, 10);
      const result = await executor.executePaginated(spec, Agent as any);

      expect(result.data).toEqual(agents);
      expect(result.total).toBe(50);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(true);
    });

    it('should calculate hasNextPage and hasPreviousPage correctly', async () => {
      mockGetManyAndCount.mockResolvedValueOnce([[], 5]);
      const result = await executor.executePaginated(
        new ActiveAgentsSpec().paginate(1, 10),
        Agent as any,
      );
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('executeOne()', () => {
    it('should call getOne() on the query builder', async () => {
      const agent = { id: '1' } as Agent;
      mockGetOne.mockResolvedValueOnce(agent);
      const result = await executor.executeOne(new ActiveAgentsSpec(), Agent as any);
      expect(result).toEqual(agent);
      expect(mockGetOne).toHaveBeenCalled();
    });

    it('should return null when no entity found', async () => {
      mockGetOne.mockResolvedValueOnce(null);
      const result = await executor.executeOne(new ActiveAgentsSpec(), Agent as any);
      expect(result).toBeNull();
    });
  });

  describe('executeCount()', () => {
    it('should call getCount() on the query builder', async () => {
      mockGetCount.mockResolvedValueOnce(42);
      const result = await executor.executeCount(new ActiveAgentsSpec(), Agent as any);
      expect(result).toBe(42);
    });
  });

  describe('executeExists()', () => {
    it('should return true when count > 0', async () => {
      mockGetCount.mockResolvedValueOnce(1);
      expect(await executor.executeExists(new ActiveAgentsSpec(), Agent as any)).toBe(true);
    });

    it('should return false when count = 0', async () => {
      mockGetCount.mockResolvedValueOnce(0);
      expect(await executor.executeExists(new ActiveAgentsSpec(), Agent as any)).toBe(false);
    });
  });

  describe('buildQueryBuilder()', () => {
    it('should return a QueryBuilder without executing', () => {
      const qb = executor.buildQueryBuilder(new ActiveAgentsSpec(), Agent as any);
      expect(qb).toBeDefined();
      expect(mockGetMany).not.toHaveBeenCalled();
    });
  });
});

// ─── SpecificationCache Tests ─────────────────────────────────────────────────

describe('SpecificationCache', () => {
  let cache: SpecificationCache;

  beforeEach(() => { cache = new SpecificationCache(); });

  it('should store and retrieve a value', async () => {
    await cache.set('key1', { data: 'test' }, 5000);
    const result = await cache.get<{ data: string }>('key1');
    expect(result).toEqual({ data: 'test' });
  });

  it('should return null for missing keys', async () => {
    const result = await cache.get('missing');
    expect(result).toBeNull();
  });

  it('should expire entries after TTL', async () => {
    await cache.set('key2', 'value', 50); // 50ms TTL
    await new Promise((r) => setTimeout(r, 100));
    const result = await cache.get('key2');
    expect(result).toBeNull();
  });

  it('should delete entries by key', async () => {
    await cache.set('key3', 'value', 5000);
    await cache.delete('key3');
    expect(await cache.get('key3')).toBeNull();
  });

  it('should invalidate entries by prefix', async () => {
    await cache.set('spec:Agent:1', 'a', 5000);
    await cache.set('spec:Agent:2', 'b', 5000);
    await cache.set('spec:Wallet:1', 'c', 5000);
    const count = await cache.invalidatePrefix('spec:Agent:');
    expect(count).toBe(2);
    expect(await cache.get('spec:Wallet:1')).toBe('c');
  });

  it('should report correct size', async () => {
    await cache.set('a', 1, 5000);
    await cache.set('b', 2, 5000);
    expect(cache.size).toBe(2);
  });

  it('should flush all entries', async () => {
    await cache.set('x', 1, 5000);
    await cache.flush();
    expect(cache.size).toBe(0);
  });
});

// ─── SpecificationValidator Tests ─────────────────────────────────────────────

describe('SpecificationValidator', () => {
  let validator: SpecificationValidator;

  beforeEach(() => { validator = new SpecificationValidator(); });

  it('should pass valid specifications', () => {
    const result = validator.validate(new ActiveAgentsSpec());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should warn on double negation', () => {
    const spec = new ActiveAgentsSpec().not().not();
    const result = validator.validate(spec);
    expect(result.warnings.some((w) => w.includes('Double negation'))).toBe(true);
  });

  it('should warn on unbounded query', () => {
    class UnboundedSpec extends Specification<Agent> {
      toQuery(): SpecificationQuery { return {}; }
    }
    const result = validator.validate(new UnboundedSpec());
    expect(result.warnings.some((w) => w.includes('no WHERE clause'))).toBe(true);
  });

  it('should warn on redundant criteria in AND chain', () => {
    const spec = new ActiveAgentsSpec().and(new ActiveAgentsSpec());
    const result = validator.validate(spec);
    expect(result.warnings.some((w) => w.includes('Redundant'))).toBe(true);
  });

  it('should surface required relations as suggestions', () => {
    class RequiresRelationSpec extends Specification<Agent> {
      constructor() {
        super({ name: 'RelSpec', requiredRelations: ['agent.owner'] });
      }
      toQuery(): SpecificationQuery { return { where: '1=1' }; }
    }
    const result = validator.validate(new RequiresRelationSpec());
    expect(result.suggestions.some((s) => s.includes('agent.owner'))).toBe(true);
  });

  it('should mark spec as invalid when custom rule adds an error', () => {
    validator.registerRule({
      name: 'always-fail',
      description: 'Always fails',
      check(_spec, result) {
        result.errors.push('Deliberately failed');
      },
    });
    const result = validator.validate(new ActiveAgentsSpec());
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Deliberately failed');
  });
});
