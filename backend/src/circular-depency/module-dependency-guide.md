# Module Dependency Guide
> LuminaryTrade — StellAIverse Backend

## Table of Contents
1. [Overview](#overview)
2. [Module Hierarchy](#module-hierarchy)
3. [Detecting Circular Dependencies](#detecting-circular-dependencies)
4. [Refactoring Strategies](#refactoring-strategies)
5. [Lazy Initialization Pattern](#lazy-initialization-pattern)
6. [Forward References](#forward-references)
7. [ESLint Rules](#eslint-rules)
8. [CI Checks](#ci-checks)
9. [Creating New Modules](#creating-new-modules)

---

## Overview

Circular dependencies cause two classes of problems in NestJS:

1. **Bootstrap failures** — NestJS cannot determine module initialization order and throws `Cannot access before initialization` or similar errors.
2. **Tight coupling** — modules become impossible to test, reuse, or refactor in isolation.

This guide documents the tools and conventions we use to detect, eliminate, and prevent circular dependencies.

---

## Module Hierarchy

All modules are assigned a **hierarchy level**. Dependencies must only flow **downward**.

```
Level 3 (API)          ┌──────────────────────────────────────────┐
                       │  Controllers · Resolvers · WS Gateways   │
                       └────────────────┬─────────────────────────┘
                                        │ imports
Level 2 (Application)  ┌───────────────▼──────────────────────────┐
                       │  Feature Services · Auth · Notifications  │
                       └────────────────┬─────────────────────────┘
                                        │ imports
Level 1 (Domain)       ┌───────────────▼──────────────────────────┐
                       │  Entities · Repositories · Domain Logic   │
                       └────────────────┬─────────────────────────┘
                                        │ imports
Level 0 (Core)         ┌───────────────▼──────────────────────────┐
                       │  Database · Cache · Config · Logger       │
                       └──────────────────────────────────────────┘
```

**Rule:** A module at Level N may only import from modules at Level < N.  
**Cross-level (same-level) imports** must be replaced with events or a shared domain concept.

Register your module's level in `.circular-dep-levels.json`:

```json
{
  "DatabaseModule": 0,
  "CacheModule": 0,
  "UserModule": 1,
  "OrderModule": 1,
  "PaymentModule": 2,
  "NotificationModule": 2,
  "AppController": 3
}
```

---

## Detecting Circular Dependencies

### Automated (recommended)

```bash
# Full report with mermaid diagram
npm run dep:report

# Quick check (used in CI)
npm run check:circular

# Generate visual SVG graph
GENERATE_GRAPH=true npm run check:circular
```

### Programmatic (in code)

```typescript
// Inject analyzer in any service/bootstrap hook
constructor(private readonly analyzer: ModuleGraphAnalyzer) {}

async onModuleInit() {
  const report = this.analyzer.generateReport();

  console.log(`Modules: ${report.totalModules}`);
  console.log(`Circular chains: ${report.circularChains.length}`);
  console.log(report.mermaidDiagram); // Paste into https://mermaid.live
}
```

### In AppModule (one-liner bootstrap)

```typescript
@Module({
  imports: [
    CircularDependencyModule.forRoot({
      srcDir: './src',
      scanOnInit: true,         // runs audit on app startup
      throwOnCircular: false,   // set true to hard-fail on circular deps
      lazyInitThresholdMs: 50,  // alert if lazy init takes > 50ms
    }),
  ],
})
export class AppModule {}
```

---

## Refactoring Strategies

### Strategy 1 — Intermediate Service Layer

**Use when:** Two services at the same level call each other.

Extract the shared behavior into a new `CoordinatorService` in a `SharedModule`. Both original services import `SharedModule` instead of each other.

```
Before:                After:
OrderService ↔         OrderService ─→ SharedModule
PaymentService    PaymentService ─→ SharedModule
```

### Strategy 2 — Extract Shared Domain Concept

**Use when:** Two modules share an entity or repository that neither should own exclusively.

Create a dedicated domain module (e.g., `AccountModule`) that owns the entity and exposes its repository. Both consumers import `AccountModule`.

### Strategy 3 — Reverse Dependency Direction

**Use when:** One module depends on behavior defined in a higher-level module.

Define an **abstract interface (port)** in the lower module. The higher module implements it and registers via a DI token. The lower module injects the token — it never knows the concrete implementation.

```typescript
// lower-module/ports/notifier.port.ts
export const NOTIFIER_PORT = Symbol('NOTIFIER_PORT');
export interface INotifier { notify(msg: string): void; }

// higher-module registers the impl
{ provide: NOTIFIER_PORT, useClass: EmailNotifier }

// lower-module uses the token
constructor(@Inject(NOTIFIER_PORT) private notifier: INotifier) {}
```

### Strategy 4 — Event-Driven Decoupling

**Use when:** Cross-module communication is asynchronous or fire-and-forget.

Replace direct service calls with domain events via `@nestjs/event-emitter` or `@nestjs/cqrs`.

```typescript
// Emitter side
this.eventBus.publish(new OrderPlacedEvent(order.id));

// Handler side (different module — no import needed)
@EventsHandler(OrderPlacedEvent)
export class OrderPlacedHandler implements IEventHandler<OrderPlacedEvent> {
  async handle(event: OrderPlacedEvent) { ... }
}
```

---

## Lazy Initialization Pattern

Use `createLazyProvider()` when you need a **temporary** bidirectional dependency that cannot yet be refactored. The lazy provider resolves the dependency on first access, breaking the initialization cycle.

```typescript
// orders.module.ts
import { createLazyProvider } from '@/circular-dependency/lazy-provider.factory';

@Module({
  imports: [forwardRef(() => PaymentModule)], // TODO: CIRCULAR-DEP #42
  providers: [
    OrdersService,
    createLazyProvider(PaymentService),  // ← registers LAZY_PaymentService
  ],
})
export class OrdersModule {}

// orders.service.ts
constructor(
  @Inject('LAZY_PaymentService') private readonly lazyPayment: LazyRef<PaymentService>,
) {}

async processOrder(dto: CreateOrderDto) {
  const payment = this.lazyPayment.getInstance(); // resolved only here
  await payment.charge(dto.amount);
}
```

**Important:** Every lazy provider use must have a linked tracking issue. This is enforced by the `no-forward-ref-without-comment` ESLint rule.

---

## Forward References

`forwardRef()` is a **last resort** for direct A↔B cycles that cannot immediately be refactored.

**Rules:**

1. Every `forwardRef()` must have a `// TODO: CIRCULAR-DEP #<issue>` comment.
2. The linked issue must describe the target refactoring strategy.
3. Forward references are reviewed in each quarterly arch review and must trend toward zero.

```typescript
// ✅ Correct — has tracking comment
imports: [
  // TODO: CIRCULAR-DEP #123 — migrate to event-driven in Q2
  forwardRef(() => NotificationModule),
]

// ❌ Wrong — no tracking comment (ESLint will flag this)
imports: [forwardRef(() => NotificationModule)]
```

---

## ESLint Rules

| Rule | Severity | Purpose |
|------|----------|---------|
| `import/no-cycle` | `error` | Detects all circular imports up to depth 5 |
| `local/no-forward-ref-without-comment` | `warn` | Requires tracking comment on forwardRef |
| `local/enforce-module-hierarchy` | `warn` | Enforces downward dependency direction |

Add to your project:

```bash
npm install --save-dev eslint-plugin-import
```

Extend your ESLint config with `.eslintrc.circular-deps.js`.

---

## CI Checks

The GitHub Actions workflow `circular-dep-check.yml` runs on every PR and:

1. Runs `madge --circular` for a full transitive analysis.
2. Runs `eslint import/no-cycle` for inline detection.
3. Uploads an SVG dependency graph as an artifact.
4. Comments on the PR with remediation guidance if circular deps are found.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CIRCULAR_DEPS` | `0` | Number of allowed circular deps before failing |
| `GENERATE_GRAPH` | `false` | Generate SVG graph |
| `CI` | — | Set by GitHub Actions; enables `process.exit(1)` |

---

## Creating New Modules

Follow this checklist when creating a new module:

1. **Assign a hierarchy level** — add to `.circular-dep-levels.json`.
2. **Check imports** — ensure all imports are from lower hierarchy levels.
3. **No same-level imports** — use events or shared domain instead.
4. **No forwardRef** — if you think you need it, reconsider the design first.
5. **Register with policy service** — call `modulePolicyService.registerModule(...)` in tests.
6. **Write a module init test** — verify the module compiles with `Test.createTestingModule(...)`.

```typescript
// ✅ Example of a well-structured feature module
@Module({
  imports: [
    DatabaseModule,   // Level 0 ✓
    UserModule,       // Level 1 ✓
    // NotificationModule is Level 2 — same as us — use events instead
  ],
  providers: [OrderService, OrderRepository],
  exports: [OrderService],
})
export class OrderModule {}   // Level 2
```

---

## package.json Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "dep:report": "ts-node -e \"require('./src/circular-dependency/run-report')\"",
    "check:circular": "node src/eslint/check-circular-deps.js",
    "ci:checks": "npm run lint && npm run check:circular && npm test"
  }
}
```
