import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ModuleGraphAnalyzer } from './module-graph.analyzer';
import { RefactoringStrategiesService } from './refactoring-strategies.service';
import { ModulePolicyService } from './module-policy.service';
import { DependencyMonitorService } from '../monitoring/dependency-monitor.service';
import { DEPENDENCY_MONITOR_OPTIONS } from './constants';
import { MonitoringOptions } from '../monitoring/dependency-monitor.service';
import { HierarchyLevel } from './module-policy.service';

export interface CircularDependencyModuleOptions extends MonitoringOptions {
  /**
   * Pre-registered module levels for policy checking.
   * Example: { UserModule: 1, OrderModule: 2, AppController: 3 }
   */
  moduleLevels?: Record<string, HierarchyLevel>;
  /**
   * Whether to throw on startup if circular deps are detected (defaults to false).
   */
  throwOnCircular?: boolean;
}

/**
 * CircularDependencyModule
 *
 * Drop this into your AppModule imports to enable:
 *  - Automatic circular dependency detection on boot
 *  - Module hierarchy policy enforcement
 *  - Lazy provider resolution support
 *  - Runtime dependency metrics
 *
 * Usage in AppModule:
 *
 * @Module({
 *   imports: [
 *     CircularDependencyModule.forRoot({
 *       srcDir: './src',
 *       scanOnInit: true,
 *       throwOnCircular: false,
 *       moduleLevels: {
 *         DatabaseModule: 0,
 *         UserModule: 1,
 *         OrderModule: 2,
 *         AppController: 3,
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 */
@Module({})
export class CircularDependencyModule {
  private static readonly logger = new Logger(CircularDependencyModule.name);

  static forRoot(options: CircularDependencyModuleOptions = {}): DynamicModule {
    return {
      module: CircularDependencyModule,
      global: true,
      providers: [
        {
          provide: DEPENDENCY_MONITOR_OPTIONS,
          useValue: options,
        },
        ModuleGraphAnalyzer,
        RefactoringStrategiesService,
        ModulePolicyService,
        {
          provide: DependencyMonitorService,
          useFactory: (analyzer: ModuleGraphAnalyzer) => {
            const service = new DependencyMonitorService(analyzer, options);

            if (options.moduleLevels) {
              // We can't inject ModulePolicyService here directly without circular issues,
              // so we expose a hook for consumers to wire it up.
              CircularDependencyModule.logger.log(
                `Registered ${Object.keys(options.moduleLevels).length} module level(s) for policy checks.`,
              );
            }

            return service;
          },
          inject: [ModuleGraphAnalyzer],
        },
      ],
      exports: [
        ModuleGraphAnalyzer,
        RefactoringStrategiesService,
        ModulePolicyService,
        DependencyMonitorService,
      ],
    };
  }
}
