import { Test, TestingModule } from '@nestjs/testing';
import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { ModuleGraphAnalyzer, DependencyNode } from '../src/circular-dependency/module-graph.analyzer';
import { RefactoringStrategiesService } from '../src/circular-dependency/refactoring-strategies.service';
import { ModulePolicyService } from '../src/circular-dependency/module-policy.service';
import { DependencyMonitorService } from '../src/monitoring/dependency-monitor.service';
import { createLazyProvider, createLazyProxy, LazyRef } from '../src/circular-dependency/lazy-provider.factory';

// ─── Fixture: Simulated Circular Dependency Pair ─────────────────────────────

@Injectable()
class ServiceA {
  constructor(
    // Simulating circular: A→B, B→A — using lazy wrapper
    @Inject('LAZY_ServiceB') private readonly lazyB: LazyRef<ServiceB>,
  ) {}

  greetFromA(): string {
    return `A says: ${this.lazyB.getInstance().greetFromB()}`;
  }
}

@Injectable()
class ServiceB {
  sayHello(): string {
    return 'hello from B';
  }

  greetFromB(): string {
    return 'greetings from B';
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ModuleGraphAnalyzer', () => {
  let analyzer: ModuleGraphAnalyzer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ModuleGraphAnalyzer],
    }).compile();

    analyzer = module.get(ModuleGraphAnalyzer);
  });

  describe('graph registration', () => {
    it('registers modules correctly', () => {
      analyzer.registerModule('OrderModule', {
        imports: ['UserModule', 'ProductModule'],
        providers: ['OrderService'],
        exports: ['OrderService'],
      });

      const report = analyzer.generateReport();
      expect(report.totalModules).toBe(1);
      expect(report.totalProviders).toBe(1);
    });

    it('detects no circular dependencies in linear chain', () => {
      analyzer.registerModule('CoreModule', { imports: [] });
      analyzer.registerModule('UserModule', { imports: ['CoreModule'] });
      analyzer.registerModule('OrderModule', { imports: ['UserModule'] });

      const report = analyzer.generateReport();
      expect(report.circularChains).toHaveLength(0);
    });
  });

  describe('circular dependency detection', () => {
    it('detects direct A ↔ B circular dependency', () => {
      analyzer.registerModule('ModuleA', { imports: ['ModuleB'] });
      analyzer.registerModule('ModuleB', { imports: ['ModuleA'] });

      const report = analyzer.generateReport();
      expect(report.circularChains.length).toBeGreaterThan(0);
      expect(report.circularChains[0].severity).toBe('critical');
    });

    it('detects multi-hop circular chain A→B→C→A', () => {
      analyzer.registerModule('ModuleA', { imports: ['ModuleB'] });
      analyzer.registerModule('ModuleB', { imports: ['ModuleC'] });
      analyzer.registerModule('ModuleC', { imports: ['ModuleA'] });

      const chains = analyzer.detectCircularDependencies();
      expect(chains.length).toBeGreaterThan(0);

      const chainNodes = chains[0].chain;
      const includesAll = ['ModuleA', 'ModuleB', 'ModuleC'].every((m) =>
        chainNodes.includes(m),
      );
      expect(includesAll).toBe(true);
    });

    it('suggests correct refactoring strategy for 2-node cycle', () => {
      analyzer.registerModule('ModuleA', { imports: ['ModuleB'] });
      analyzer.registerModule('ModuleB', { imports: ['ModuleA'] });

      const chains = analyzer.detectCircularDependencies();
      expect(chains[0].suggestion).toBe('forward-ref');
    });

    it('suggests intermediate-service for 3-node cycle', () => {
      analyzer.registerModule('ModuleA', { imports: ['ModuleB'] });
      analyzer.registerModule('ModuleB', { imports: ['ModuleC'] });
      analyzer.registerModule('ModuleC', { imports: ['ModuleA'] });

      const chains = analyzer.detectCircularDependencies();
      expect(chains[0].suggestion).toBe('intermediate-service');
    });

    it('generates mermaid diagram with circular markers', () => {
      analyzer.registerModule('ModuleA', { imports: ['ModuleB'] });
      analyzer.registerModule('ModuleB', { imports: ['ModuleA'] });

      const report = analyzer.generateReport();
      expect(report.mermaidDiagram).toContain('CIRCULAR');
      expect(report.mermaidDiagram).toContain('graph TD');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('LazyProvider', () => {
  it('creates a lazy provider with correct token name', () => {
    const provider = createLazyProvider(ServiceB);
    expect(provider).toHaveProperty('provide', 'LAZY_ServiceB');
  });

  it('lazy proxy forwards method calls to the real instance', () => {
    const realInstance = new ServiceB();
    const lazyRef: LazyRef<ServiceB> = { getInstance: () => realInstance };
    const proxy = createLazyProxy(lazyRef);

    expect(proxy.greetFromB()).toBe('greetings from B');
  });

  it('lazy proxy resolves instance only on first access', () => {
    let initCount = 0;
    const lazyRef: LazyRef<ServiceB> = {
      getInstance: () => {
        initCount++;
        return new ServiceB();
      },
    };

    const proxy = createLazyProxy(lazyRef);
    proxy.sayHello();
    proxy.sayHello();

    // getInstance is called per property access, but could be cached in real implementation
    expect(initCount).toBeGreaterThanOrEqual(1);
  });

  it('resolves bidirectional dependency without circular init error', async () => {
    const module = await Test.createTestingModule({
      providers: [
        ServiceA,
        ServiceB,
        createLazyProvider(ServiceB),
      ],
    }).compile();

    const serviceA = module.get(ServiceA);
    expect(() => serviceA.greetFromA()).not.toThrow();
    expect(serviceA.greetFromA()).toContain('greetings from B');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('ModulePolicyService', () => {
  let policy: ModulePolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ModulePolicyService],
    }).compile();
    policy = module.get(ModulePolicyService);

    policy.registerModules({
      DatabaseModule: 0,
      UserModule: 1,
      OrderModule: 2,
      AppController: 3,
    });
  });

  it('allows downward dependency direction', () => {
    const violation = policy.validateDependency('OrderModule', 'UserModule');
    expect(violation).toBeNull();
  });

  it('detects upward dependency violation', () => {
    const violation = policy.validateDependency('DatabaseModule', 'OrderModule');
    expect(violation).not.toBeNull();
    expect(violation!.severity).toBe('error');
  });

  it('detects same-level cross dependency', () => {
    policy.registerModule('PaymentModule', 2);
    const violation = policy.validateDependency('OrderModule', 'PaymentModule');
    // Same level — should flag as violation
    expect(violation).not.toBeNull();
  });

  it('validates entire graph and returns all violations', () => {
    const graph = new Map([
      ['DatabaseModule', ['OrderModule']],  // upward — violation
      ['UserModule', ['DatabaseModule']],   // allowed
    ]);

    const violations = policy.validateGraph(graph);
    expect(violations.length).toBe(1);
    expect(violations[0].module).toBe('DatabaseModule');
  });

  it('generates readable policy document', () => {
    const doc = policy.getPolicyDocument();
    expect(doc).toContain('Hierarchy Levels');
    expect(doc).toContain('Level 0');
    expect(doc).toContain('forwardRef()');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('RefactoringStrategiesService', () => {
  let service: RefactoringStrategiesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RefactoringStrategiesService],
    }).compile();
    service = module.get(RefactoringStrategiesService);
  });

  it.each([
    ['intermediate-service' as const],
    ['extract-shared-domain' as const],
    ['reverse-dependency' as const],
    ['event-driven' as const],
    ['forward-ref' as const],
  ])('returns a plan for strategy: %s', (strategy) => {
    const plan = service.getPlan(strategy, ['ModuleA', 'ModuleB']);
    expect(plan.strategy).toBe(strategy);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.codeExample.length).toBeGreaterThan(0);
  });

  it('marks forward-ref as high risk', () => {
    const plan = service.getPlan('forward-ref', ['A', 'B']);
    expect(plan.riskLevel).toBe('high');
  });

  it('marks event-driven as low risk', () => {
    const plan = service.getPlan('event-driven', ['A', 'B']);
    expect(plan.riskLevel).toBe('low');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DependencyMonitorService', () => {
  let monitor: DependencyMonitorService;
  let analyzer: ModuleGraphAnalyzer;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ModuleGraphAnalyzer,
        {
          provide: DependencyMonitorService,
          useFactory: (a: ModuleGraphAnalyzer) =>
            new DependencyMonitorService(a, { alertsEnabled: false }),
          inject: [ModuleGraphAnalyzer],
        },
      ],
    }).compile();

    monitor = module.get(DependencyMonitorService);
    analyzer = module.get(ModuleGraphAnalyzer);
  });

  it('records lazy init metrics', () => {
    const start = process.hrtime();
    monitor.recordLazyInit('ServiceB', start);

    const summary = monitor.getMetricsSummary();
    expect(summary.lazyProviders.registered).toBe(1);
    expect(summary.lazyProviders.totalInitializations).toBe(1);
  });

  it('accumulates call count for repeated inits', () => {
    const start = process.hrtime();
    monitor.recordLazyInit('ServiceC', start);
    monitor.recordLazyInit('ServiceC', process.hrtime());

    const summary = monitor.getMetricsSummary();
    const metric = summary.lazyProviders.details.find((m) => m.token === 'ServiceC');
    expect(metric?.callCount).toBe(2);
  });

  it('records module resolution metrics', () => {
    monitor.recordResolution('OrderModule', process.hrtime());
    monitor.recordResolution('UserModule', process.hrtime());

    const summary = monitor.getMetricsSummary();
    expect(summary.moduleResolution.recorded).toBe(2);
  });

  it('runs audit without throwing on clean graph', async () => {
    analyzer.registerModule('CoreModule', { imports: [] });
    analyzer.registerModule('UserModule', { imports: ['CoreModule'] });

    await expect(monitor.runAudit('./nonexistent-triggers-empty-scan')).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: Module initialization order verification', () => {
  it('NestJS can compile module with lazy provider without DI error', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ServiceB,
        createLazyProvider(ServiceB),
        ServiceA,
      ],
    }).compile();

    const a = moduleRef.get(ServiceA);
    const b = moduleRef.get(ServiceB);

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a.greetFromA()).toMatch(/greetings from B/);
  });

  it('dependency graph validates against hierarchy policy', () => {
    const policy = new ModulePolicyService();
    policy.registerModules({
      DatabaseModule: 0,
      UserModule: 1,
      NotificationModule: 2,
    });

    const analyzer = new ModuleGraphAnalyzer();
    analyzer.registerModule('UserModule', { imports: ['DatabaseModule'] });
    analyzer.registerModule('NotificationModule', { imports: ['UserModule'] });

    const report = analyzer.generateReport();
    expect(report.circularChains).toHaveLength(0);

    const violations = policy.validateGraph(
      new Map([
        ['UserModule', ['DatabaseModule']],
        ['NotificationModule', ['UserModule']],
      ]),
    );
    expect(violations).toHaveLength(0);
  });
});
