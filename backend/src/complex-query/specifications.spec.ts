import { Specification, QueryContext, SpecificationQuery } from '../core/specification.abstract';
import { AndSpecification } from '../core/composite/and.specification';
import { OrSpecification } from '../core/composite/or.specification';
import { NotSpecification } from '../core/composite/not.specification';
import { PaginatedSpecification } from '../core/paginated-specification';
import { ActiveAgentsSpec, HighScoreAgentsSpec, RecentlyUpdatedSpec, AgentOwnedBySpec, AgentSpecificationBuilder, Agent } from '../domain/agents/agent.specifications';
import { ActiveEntitiesSpec } from '../common/active-entities.specification';
import { ByIdSpec } from '../common/by-id.specification';
import { CreatedAfterSpec, UpdatedWithinDaysSpec } from '../common/created-after.specification';
import { OwnedBySpec } from '../common/related-to.specification';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeContext(alias = 'entity'): QueryContext {
  return { alias, addedJoins: new Set(), parameterIndex: 0 };
}

class TrueSpec<T> extends Specification<T> {
  toQuery(context: QueryContext): SpecificationQuery {
    return { where: `1 = 1` };
  }
  isSatisfiedBy(): boolean { return true; }
}

class FalseSpec<T> extends Specification<T> {
  toQuery(context: QueryContext): SpecificationQuery {
    return { where: `1 = 0` };
  }
  isSatisfiedBy(): boolean { return false; }
}

class ActiveSpec<T extends { isActive: boolean }> extends Specification<T> {
  toQuery(ctx: QueryContext): SpecificationQuery {
    return {
      where: `${ctx.alias}.isActive = :isActive`,
      parameters: { isActive: true },
    };
  }
  isSatisfiedBy(c: Partial<T>): boolean { return (c as { isActive: boolean }).isActive === true; }
}

// ─── Specification Unit Tests ─────────────────────────────────────────────────

describe('Specification — base', () => {
  it('should produce a WHERE clause from toQuery()', () => {
    const spec = new ActiveSpec<{ isActive: boolean }>();
    const query = spec.toQuery(makeContext('user'));
    expect(query.where).toBe('user.isActive = :isActive');
    expect(query.parameters).toEqual({ isActive: true });
  });

  it('should expose metadata with the class name as default', () => {
    const spec = new TrueSpec();
    expect(spec.metadata.name).toBe('TrueSpec');
  });

  it('should throw on unimplemented isSatisfiedBy()', () => {
    class NoMemorySpec extends Specification<{ x: number }> {
      toQuery(): SpecificationQuery { return {}; }
    }
    const spec = new NoMemorySpec();
    expect(() => spec.isSatisfiedBy({})).toThrow();
  });
});

// ─── AND Composite Tests ──────────────────────────────────────────────────────

describe('AndSpecification', () => {
  it('should combine two WHERE clauses with AND', () => {
    const spec = new TrueSpec<{ isActive: boolean; score: number }>()
      .and(new FalseSpec());
    const query = spec.toQuery(makeContext());
    expect(query.where).toBe('(1 = 1) AND (1 = 0)');
  });

  it('should merge parameters from both sides', () => {
    const left = new ActiveAgentsSpec();
    const right = new HighScoreAgentsSpec(75);
    const spec = left.and(right);
    const query = spec.toQuery(makeContext('agent'));
    expect(query.parameters).toMatchObject({
      activeEntitiesIsActive: true,
      highScoreMin: 75,
    });
  });

  it('should correctly evaluate isSatisfiedBy() for AND', () => {
    const and = new TrueSpec<Agent>().and(new FalseSpec<Agent>());
    expect(and.isSatisfiedBy({} as Agent)).toBe(false);

    const both = new TrueSpec<Agent>().and(new TrueSpec<Agent>());
    expect(both.isSatisfiedBy({} as Agent)).toBe(true);
  });

  it('should flatten nested ANDs', () => {
    const spec = new TrueSpec<Agent>()
      .and(new TrueSpec<Agent>())
      .and(new TrueSpec<Agent>());
    const leaves = spec.flatten();
    expect(leaves.length).toBe(3);
  });

  it('should deduplicate joins from both sides', () => {
    class WithJoinSpec extends Specification<Agent> {
      toQuery(): SpecificationQuery {
        return {
          joins: [{ type: 'left', relation: 'agent.owner', alias: 'owner' }],
          where: '1=1',
        };
      }
    }
    const spec = new WithJoinSpec().and(new WithJoinSpec());
    const query = spec.toQuery(makeContext('agent'));
    expect(query.joins?.length).toBe(1);
  });

  it('should support chaining three or more specs', () => {
    const spec = new ActiveAgentsSpec()
      .and(new HighScoreAgentsSpec(80))
      .and(new RecentlyUpdatedSpec(7))
      .and(new AgentOwnedBySpec('user-123'));
    const query = spec.toQuery(makeContext('agent'));
    expect(query.where).toContain('activeEntitiesIsActive');
    expect(query.where).toContain('highScoreMin');
    expect(query.where).toContain('updatedWithinSince');
    expect(query.where).toContain('ownedByUserId');
  });
});

// ─── OR Composite Tests ───────────────────────────────────────────────────────

describe('OrSpecification', () => {
  it('should combine two WHERE clauses with OR', () => {
    const spec = new TrueSpec<Agent>().or(new FalseSpec<Agent>());
    const query = spec.toQuery(makeContext());
    expect(query.where).toBe('(1 = 1) OR (1 = 0)');
  });

  it('should evaluate isSatisfiedBy() as true if either side is true', () => {
    expect(new TrueSpec<Agent>().or(new FalseSpec<Agent>()).isSatisfiedBy({} as Agent)).toBe(true);
    expect(new FalseSpec<Agent>().or(new TrueSpec<Agent>()).isSatisfiedBy({} as Agent)).toBe(true);
    expect(new FalseSpec<Agent>().or(new FalseSpec<Agent>()).isSatisfiedBy({} as Agent)).toBe(false);
  });

  it('should generate correct description', () => {
    const spec = new TrueSpec<Agent>().or(new FalseSpec<Agent>());
    expect(spec.describe()).toContain('OR');
  });
});

// ─── NOT Composite Tests ──────────────────────────────────────────────────────

describe('NotSpecification', () => {
  it('should wrap WHERE in NOT(...)', () => {
    const spec = new TrueSpec<Agent>().not();
    const query = spec.toQuery(makeContext());
    expect(query.where).toBe('NOT (1 = 1)');
  });

  it('should negate isSatisfiedBy()', () => {
    expect(new TrueSpec<Agent>().not().isSatisfiedBy({} as Agent)).toBe(false);
    expect(new FalseSpec<Agent>().not().isSatisfiedBy({} as Agent)).toBe(true);
  });

  it('should produce double NOT when chained twice', () => {
    const spec = new TrueSpec<Agent>().not().not();
    const query = spec.toQuery(makeContext());
    expect(query.where).toBe('NOT (NOT (1 = 1))');
  });
});

// ─── Paginated Specification Tests ───────────────────────────────────────────

describe('PaginatedSpecification', () => {
  it('should delegate toQuery to the inner spec', () => {
    const inner = new ActiveAgentsSpec();
    const paged = inner.paginate(2, 10);
    expect(paged.inner).toBe(inner);
    expect(paged.pagination).toEqual({ page: 2, limit: 10 });
  });

  it('should produce a new paginated spec with withPage()', () => {
    const paged = new ActiveAgentsSpec().paginate(1, 10).withPage(3);
    expect(paged.pagination.page).toBe(3);
  });

  it('should produce a new paginated spec with withLimit()', () => {
    const paged = new ActiveAgentsSpec().paginate(1, 10).withLimit(25);
    expect(paged.pagination.limit).toBe(25);
  });

  it('should describe pagination in its string representation', () => {
    const desc = new ActiveAgentsSpec().paginate(1, 20).describe();
    expect(desc).toContain('page=1');
    expect(desc).toContain('limit=20');
  });
});

// ─── Generic Specification Tests ─────────────────────────────────────────────

describe('ByIdSpec', () => {
  it('should generate a WHERE clause for primary key', () => {
    const spec = new ByIdSpec<Agent & { id: string }>('abc-123');
    const query = spec.toQuery(makeContext('agent'));
    expect(query.where).toBe('agent.id = :byIdValue');
    expect(query.parameters?.byIdValue).toBe('abc-123');
  });

  it('should satisfy candidates with matching id', () => {
    const spec = new ByIdSpec<{ id: string }>('abc');
    expect(spec.isSatisfiedBy({ id: 'abc' })).toBe(true);
    expect(spec.isSatisfiedBy({ id: 'xyz' })).toBe(false);
  });
});

describe('CreatedAfterSpec', () => {
  it('should produce a WHERE clause with the given date', () => {
    const since = new Date('2024-01-01');
    const spec = new CreatedAfterSpec<{ createdAt: Date }>(since);
    const query = spec.toQuery(makeContext('e'));
    expect(query.where).toBe('e.createdAt > :createdAfterSince');
    expect(query.parameters?.createdAfterSince).toBe(since);
  });

  it('should correctly evaluate isSatisfiedBy()', () => {
    const since = new Date('2024-06-01');
    const spec = new CreatedAfterSpec<{ createdAt: Date }>(since);
    expect(spec.isSatisfiedBy({ createdAt: new Date('2024-07-01') })).toBe(true);
    expect(spec.isSatisfiedBy({ createdAt: new Date('2024-01-01') })).toBe(false);
  });
});

describe('UpdatedWithinDaysSpec', () => {
  it('should match recently updated entities', () => {
    const spec = new UpdatedWithinDaysSpec<{ updatedAt: Date }>(7);
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    expect(spec.isSatisfiedBy({ updatedAt: recent })).toBe(true);
    expect(spec.isSatisfiedBy({ updatedAt: old })).toBe(false);
  });
});

describe('OwnedBySpec', () => {
  it('should filter by ownerId', () => {
    const spec = new OwnedBySpec<{ ownerId: string }>('user-99');
    const query = spec.toQuery(makeContext('a'));
    expect(query.where).toBe('a.ownerId = :ownedByUserId');
    expect(query.parameters?.ownedByUserId).toBe('user-99');
  });

  it('should satisfy candidates with matching ownerId', () => {
    const spec = new OwnedBySpec<{ ownerId: string }>('u1');
    expect(spec.isSatisfiedBy({ ownerId: 'u1' })).toBe(true);
    expect(spec.isSatisfiedBy({ ownerId: 'u2' })).toBe(false);
  });
});

// ─── AgentSpecificationBuilder Tests ─────────────────────────────────────────

describe('AgentSpecificationBuilder', () => {
  it('should build a single spec', () => {
    const spec = AgentSpecificationBuilder.create().active().build();
    expect(spec).toBeInstanceOf(ActiveAgentsSpec);
  });

  it('should chain multiple criteria into an AND spec', () => {
    const spec = AgentSpecificationBuilder.create()
      .active()
      .highScore(70)
      .build();
    const query = spec.toQuery(makeContext('agent'));
    expect(query.where).toContain('activeEntitiesIsActive');
    expect(query.where).toContain('highScoreMin');
  });

  it('should throw if build() is called with no criteria', () => {
    expect(() => AgentSpecificationBuilder.create().build()).toThrow();
  });

  it('should support paginate on the result', () => {
    const spec = AgentSpecificationBuilder.create()
      .active()
      .ownedBy('u1')
      .build()
      .paginate(1, 10);
    expect(spec).toBeInstanceOf(PaginatedSpecification);
    expect(spec.pagination).toEqual({ page: 1, limit: 10 });
  });

  it('should match the canonical complex query from the issue', () => {
    const userId = 'user-abc';
    const spec = new ActiveAgentsSpec()
      .and(new HighScoreAgentsSpec(70))
      .and(new RecentlyUpdatedSpec(14))
      .and(new AgentOwnedBySpec(userId))
      .paginate(1, 20);

    expect(spec).toBeInstanceOf(PaginatedSpecification);
    const innerQuery = spec.toQuery(makeContext('agent'));
    expect(innerQuery.where).toContain('agent.isActive');
    expect(innerQuery.parameters?.highScoreMin).toBe(70);
    expect(innerQuery.parameters?.ownedByUserId).toBe(userId);
  });
});
