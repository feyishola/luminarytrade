import { Injectable, Logger } from '@nestjs/common';

/**
 * Module hierarchy levels — dependencies must only flow downward.
 *
 * Level 0 (Core)       → infrastructure primitives (DB, cache, config)
 * Level 1 (Domain)     → business entities and repositories
 * Level 2 (Application)→ use-case services
 * Level 3 (API)        → controllers, resolvers, gateways
 *
 * Policy: A module at level N may only import from levels < N.
 * Cross-level imports at the same level must use events or shared domain concepts.
 */
export type HierarchyLevel = 0 | 1 | 2 | 3;

export interface ModulePolicy {
  name: string;
  level: HierarchyLevel;
  allowedImports: HierarchyLevel[];
  description: string;
}

export interface PolicyViolation {
  module: string;
  importedModule: string;
  reason: string;
  severity: 'error' | 'warning';
}

@Injectable()
export class ModulePolicyService {
  private readonly logger = new Logger(ModulePolicyService.name);

  private readonly levelNames: Record<HierarchyLevel, string> = {
    0: 'Core / Infrastructure',
    1: 'Domain / Data',
    2: 'Application / Features',
    3: 'API / Presentation',
  };

  private readonly allowedDownwardImports: Record<HierarchyLevel, HierarchyLevel[]> = {
    0: [],           // Core imports nothing
    1: [0],          // Domain imports Core
    2: [0, 1],       // Application imports Domain & Core
    3: [0, 1, 2],    // API imports everything below
  };

  private registeredModules: Map<string, HierarchyLevel> = new Map();

  /**
   * Register a module with its hierarchy level.
   */
  registerModule(name: string, level: HierarchyLevel): void {
    this.registeredModules.set(name, level);
  }

  /**
   * Register multiple modules at once.
   */
  registerModules(modules: Record<string, HierarchyLevel>): void {
    for (const [name, level] of Object.entries(modules)) {
      this.registerModule(name, level as HierarchyLevel);
    }
  }

  /**
   * Validate a proposed dependency between two modules.
   */
  validateDependency(fromModule: string, toModule: string): PolicyViolation | null {
    const fromLevel = this.registeredModules.get(fromModule);
    const toLevel = this.registeredModules.get(toModule);

    if (fromLevel === undefined || toLevel === undefined) {
      return null; // Can't validate unregistered modules
    }

    const allowed = this.allowedDownwardImports[fromLevel];

    if (!allowed.includes(toLevel)) {
      return {
        module: fromModule,
        importedModule: toModule,
        reason:
          `${fromModule} (${this.levelNames[fromLevel]}) must not import ` +
          `${toModule} (${this.levelNames[toLevel]}). ` +
          `Level ${fromLevel} modules may only import from levels: [${allowed.join(', ')}].`,
        severity: toLevel >= fromLevel ? 'error' : 'warning',
      };
    }

    return null;
  }

  /**
   * Validate all registered module dependencies at once.
   */
  validateGraph(graph: Map<string, string[]>): PolicyViolation[] {
    const violations: PolicyViolation[] = [];

    for (const [moduleName, imports] of graph) {
      for (const importedModule of imports) {
        const violation = this.validateDependency(moduleName, importedModule);
        if (violation) {
          violations.push(violation);
          this.logger.warn(`Policy violation: ${violation.reason}`);
        }
      }
    }

    return violations;
  }

  /**
   * Returns the allowed dependency directions policy document.
   */
  getPolicyDocument(): string {
    return `
# Module Dependency Policy

## Hierarchy Levels

| Level | Name                    | Examples                                      |
|-------|-------------------------|-----------------------------------------------|
| 0     | Core / Infrastructure   | DatabaseModule, CacheModule, ConfigModule     |
| 1     | Domain / Data           | UserModule, OrderModule, ProductModule        |
| 2     | Application / Features  | PaymentModule, NotificationModule, AuthModule |
| 3     | API / Presentation      | UserController, OrderResolver, WsGateway      |

## Allowed Import Directions

- Level 0 → imports nothing
- Level 1 → may import Level 0
- Level 2 → may import Levels 0, 1
- Level 3 → may import Levels 0, 1, 2

## Prohibited Patterns

- Same-level cross-imports (use events or shared domain instead)
- Upward imports (Level 0 importing Level 2, etc.)
- Skipping levels is allowed but discouraged

## Exceptions

- forwardRef() is allowed ONLY as a temporary measure
- All forwardRef() usages must have a tracking issue comment
- Reviewed quarterly for elimination
`.trim();
  }
}
