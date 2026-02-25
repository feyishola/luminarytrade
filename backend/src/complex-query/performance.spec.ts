import { Specification, QueryContext, SpecificationQuery } from '../core/specification.abstract';
import { AndSpecification } from '../core/composite/and.specification';
import {
  ActiveAgentsSpec,
  HighScoreAgentsSpec,
  RecentlyUpdatedSpec,
  AgentOwnedBySpec,
  AgentHasTagSpec,
  AgentSpecificationBuilder,
  Agent,
} from '../domain/agents/agent.specifications';

function makeContext(alias = 'agent'): QueryContext {
  return { alias, addedJoins: new Set(), parameterIndex: 0 };
}

function measureMs(fn: () => void, iterations = 1000): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return (performance.now() - start) / iterations;
}

describe('Specification performance', () => {
  it('should compile a simple spec in under 1ms', () => {
    const spec = new ActiveAgentsSpec();
    const avgMs = measureMs(() => spec.toQuery(makeContext()), 5000);
    expect(avgMs).toBeLessThan(1);
  });

  it('should compile a 4-deep AND chain in under 2ms', () => {
    const spec = new ActiveAgentsSpec()
      .and(new HighScoreAgentsSpec(80))
      .and(new RecentlyUpdatedSpec(7))
      .and(new AgentOwnedBySpec('user-x'));
    const avgMs = measureMs(() => spec.toQuery(makeContext()), 2000);
    expect(avgMs).toBeLessThan(2);
  });

  it('should compile a 10-deep AND chain in under 5ms', () => {
    let spec: Specification<Agent> = new ActiveAgentsSpec();
    for (let i = 0; i < 9; i++) {
      spec = spec.and(new HighScoreAgentsSpec(i * 10));
    }
    const avgMs = measureMs(() => spec.toQuery(makeContext()), 1000);
    expect(avgMs).toBeLessThan(5);
  });

  it('should build a spec via the fluent builder at roughly the same speed as manual construction', () => {
    const manualSpec = new ActiveAgentsSpec()
      .and(new HighScoreAgentsSpec(80))
      .and(new RecentlyUpdatedSpec(7))
      .and(new AgentOwnedBySpec('u1'));

    const manualAvg = measureMs(() => manualSpec.toQuery(makeContext()), 2000);

    const builderAvg = measureMs(() => {
      const spec = AgentSpecificationBuilder.create()
        .active()
        .highScore(80)
        .recentlyUpdated(7)
        .ownedBy('u1')
        .build();
      spec.toQuery(makeContext());
    }, 2000);

    // Builder should not be more than 3x slower than manual construction
    expect(builderAvg).toBeLessThan(manualAvg * 3 + 1);
  });

  it('should flatten a 20-spec AND chain without stack overflow', () => {
    let spec: AndSpecification<Agent> = new ActiveAgentsSpec().and(new HighScoreAgentsSpec(1));
    for (let i = 2; i < 20; i++) {
      spec = spec.and(new AgentHasTagSpec(`tag-${i}`)) as AndSpecification<Agent>;
    }
    expect(() => spec.flatten()).not.toThrow();
    expect(spec.flatten().length).toBe(20);
  });

  it('should compute correct toQuery output on a deeply nested composite', () => {
    let spec: Specification<Agent> = new ActiveAgentsSpec();
    for (let i = 1; i <= 5; i++) {
      spec = spec.and(new HighScoreAgentsSpec(i * 10));
    }
    const query = spec.toQuery(makeContext('a'));
    expect(query.where).toBeTruthy();
    expect(Object.keys(query.parameters ?? {}).length).toBeGreaterThanOrEqual(6);
  });
});
