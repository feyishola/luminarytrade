import { Injectable, Logger } from '@nestjs/common';
import { CircularChain, RefactorStrategy } from './module-graph.analyzer';

export interface RefactorPlan {
  strategy: RefactorStrategy;
  description: string;
  steps: string[];
  codeExample: string;
  effort: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Provides concrete refactoring plans for each circular dependency strategy.
 *
 * Strategy 1: Intermediate Service Layer
 * Strategy 2: Extract Shared Domain Concept
 * Strategy 3: Reverse Dependency Direction
 * Strategy 4: Event-Driven Decoupling
 */
@Injectable()
export class RefactoringStrategiesService {
  private readonly logger = new Logger(RefactoringStrategiesService.name);

  /**
   * Returns a refactoring plan for a detected circular chain.
   */
  getPlanForChain(chain: CircularChain): RefactorPlan {
    return this.getPlan(chain.suggestion, chain.chain);
  }

  getPlan(strategy: RefactorStrategy, modules: string[]): RefactorPlan {
    switch (strategy) {
      case 'intermediate-service':
        return this.buildIntermediateServicePlan(modules);
      case 'extract-shared-domain':
        return this.buildExtractSharedDomainPlan(modules);
      case 'reverse-dependency':
        return this.buildReverseDependencyPlan(modules);
      case 'event-driven':
        return this.buildEventDrivenPlan(modules);
      case 'forward-ref':
        return this.buildForwardRefPlan(modules);
    }
  }

  // ─── Strategy 1: Intermediate Service ────────────────────────────────────────

  private buildIntermediateServicePlan(modules: string[]): RefactorPlan {
    const [moduleA, moduleB] = modules;
    return {
      strategy: 'intermediate-service',
      description:
        'Introduce a mediator/coordinator service that both modules depend on, ' +
        'removing the direct bidirectional dependency.',
      effort: 'medium',
      riskLevel: 'low',
      steps: [
        `Create a new SharedModule with a CoordinatorService`,
        `Move shared logic from ${moduleA} and ${moduleB} into CoordinatorService`,
        `Both ${moduleA} and ${moduleB} import SharedModule`,
        `Remove direct cross-imports between ${moduleA} and ${moduleB}`,
        `Update all call sites to use CoordinatorService`,
      ],
      codeExample: `
// shared/coordinator.service.ts
@Injectable()
export class CoordinatorService {
  // Logic previously in ${moduleA} that ${moduleB} needed
  sharedOperation(): void { ... }
}

// ${moduleA}.module.ts
@Module({
  imports: [SharedModule],      // ← depends on shared, not on ${moduleB}
  providers: [${moduleA}Service],
})
export class ${moduleA}Module {}

// ${moduleB}.module.ts
@Module({
  imports: [SharedModule],      // ← depends on shared, not on ${moduleA}
  providers: [${moduleB}Service],
})
export class ${moduleB}Module {}
`.trim(),
    };
  }

  // ─── Strategy 2: Extract Shared Domain ───────────────────────────────────────

  private buildExtractSharedDomainPlan(modules: string[]): RefactorPlan {
    return {
      strategy: 'extract-shared-domain',
      description:
        'Extract the shared domain concept (entity, value object, or interface) into its own module. ' +
        'Both modules depend on the domain module, not on each other.',
      effort: 'high',
      riskLevel: 'medium',
      steps: [
        'Identify the shared domain entity or concept causing the cycle',
        'Create a dedicated DomainModule with the entity, repository, and core service',
        `Update ${modules.join(', ')} to import DomainModule`,
        'Remove cross-module provider sharing',
        'Adjust DI tokens if needed',
      ],
      codeExample: `
// domain/user-account.module.ts  (new shared domain module)
@Module({
  imports: [TypeOrmModule.forFeature([UserAccount])],
  providers: [UserAccountRepository],
  exports: [UserAccountRepository],
})
export class UserAccountModule {}

// Each consuming module
@Module({
  imports: [UserAccountModule],
  providers: [...],
})
export class OrdersModule {}
`.trim(),
    };
  }

  // ─── Strategy 3: Reverse Dependency ──────────────────────────────────────────

  private buildReverseDependencyPlan(modules: string[]): RefactorPlan {
    const [moduleA, moduleB] = modules;
    return {
      strategy: 'reverse-dependency',
      description:
        `Make ${moduleB} depend on ${moduleA} (one direction only) by inverting ` +
        `the dependency through an abstract interface / port.`,
      effort: 'medium',
      riskLevel: 'medium',
      steps: [
        `Define an interface (port) in ${moduleA} that ${moduleB} must implement`,
        `${moduleB} implements the interface and registers via a token`,
        `${moduleA} injects the interface token instead of ${moduleB}Service directly`,
        `Wire the token in AppModule or a shared config module`,
      ],
      codeExample: `
// ${moduleA}/ports/notification.port.ts
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
export interface INotificationPort {
  notify(event: string): Promise<void>;
}

// ${moduleB}/${moduleB}.service.ts implements the port
@Injectable()
export class ${moduleB}Service implements INotificationPort {
  async notify(event: string) { ... }
}

// ${moduleB}.module.ts
@Module({
  providers: [
    ${moduleB}Service,
    { provide: NOTIFICATION_PORT, useExisting: ${moduleB}Service },
  ],
  exports: [NOTIFICATION_PORT],
})
export class ${moduleB}Module {}

// ${moduleA}.service.ts
constructor(@Inject(NOTIFICATION_PORT) private notifier: INotificationPort) {}
`.trim(),
    };
  }

  // ─── Strategy 4: Event-Driven ────────────────────────────────────────────────

  private buildEventDrivenPlan(modules: string[]): RefactorPlan {
    return {
      strategy: 'event-driven',
      description:
        'Replace direct service calls across module boundaries with domain events. ' +
        'Use NestJS EventEmitter2 or CQRS EventBus to fully decouple modules.',
      effort: 'high',
      riskLevel: 'low',
      steps: [
        'Install @nestjs/event-emitter or @nestjs/cqrs',
        'Define domain event classes in a shared events barrel',
        'Replace direct cross-module method calls with this.eventBus.publish(new XyzEvent(...))',
        'Add @EventsHandler() in the receiving module',
        'Remove cross-module imports entirely',
      ],
      codeExample: `
// events/order-placed.event.ts
export class OrderPlacedEvent {
  constructor(public readonly orderId: string, public readonly userId: string) {}
}

// orders/orders.service.ts
constructor(private readonly eventBus: EventBus) {}

async placeOrder(dto: PlaceOrderDto) {
  // ... business logic ...
  this.eventBus.publish(new OrderPlacedEvent(order.id, dto.userId));
}

// notifications/handlers/order-placed.handler.ts
@EventsHandler(OrderPlacedEvent)
export class OrderPlacedHandler implements IEventHandler<OrderPlacedEvent> {
  async handle(event: OrderPlacedEvent) {
    // send notification — no direct dependency on OrdersModule
  }
}
`.trim(),
    };
  }

  // ─── Forward Ref (temporary) ─────────────────────────────────────────────────

  private buildForwardRefPlan(modules: string[]): RefactorPlan {
    const [moduleA, moduleB] = modules;
    return {
      strategy: 'forward-ref',
      description:
        `Use NestJS forwardRef() as a TEMPORARY solution for direct A↔B cycles. ` +
        `Must be tracked and eliminated via one of the other strategies.`,
      effort: 'low',
      riskLevel: 'high',
      steps: [
        `Wrap the circular import with forwardRef(() => ${moduleB}Module)`,
        `Add corresponding forwardRef(() => ${moduleA}Module) in ${moduleB}`,
        'Open a tracking issue to replace with a permanent strategy',
        'Add a // TODO: CIRCULAR-DEP comment with the issue number',
      ],
      codeExample: `
// ${moduleA}.module.ts
@Module({
  imports: [
    forwardRef(() => ${moduleB}Module), // TODO: CIRCULAR-DEP #123 — replace with event-driven
  ],
})
export class ${moduleA}Module {}

// ${moduleA}.service.ts
constructor(
  @Inject(forwardRef(() => ${moduleB}Service))
  private readonly ${moduleB.toLowerCase()}Service: ${moduleB}Service,
) {}
`.trim(),
    };
  }
}
