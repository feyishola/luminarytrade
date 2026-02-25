// Decorators
export { Lazy, InjectLazy } from './decorators/lazy.decorator';

// Core module
export { CircularDependencyModule } from './circular-dependency/circular-dependency.module';
export type { CircularDependencyModuleOptions } from './circular-dependency/circular-dependency.module';

// Analyzer
export { ModuleGraphAnalyzer } from './circular-dependency/module-graph.analyzer';
export type {
  DependencyNode,
  CircularChain,
  DependencyReport,
  RefactorStrategy,
} from './circular-dependency/module-graph.analyzer';

// Lazy provider factory
export {
  createLazyProvider,
  createLazyProviders,
  createLazyProxy,
} from './circular-dependency/lazy-provider.factory';
export type { LazyRef } from './circular-dependency/lazy-provider.factory';

// Refactoring strategies
export { RefactoringStrategiesService } from './circular-dependency/refactoring-strategies.service';
export type { RefactorPlan } from './circular-dependency/refactoring-strategies.service';

// Module policy
export { ModulePolicyService } from './circular-dependency/module-policy.service';
export type {
  HierarchyLevel,
  ModulePolicy,
  PolicyViolation,
} from './circular-dependency/module-policy.service';

// Monitoring
export { DependencyMonitorService } from './monitoring/dependency-monitor.service';
export type {
  LazyInitMetric,
  DependencyResolutionMetric,
  MonitoringOptions,
} from './monitoring/dependency-monitor.service';

// Constants
export {
  LAZY_INJECT_TOKEN,
  DEPENDENCY_GRAPH_TOKEN,
  LAZY_PROVIDER_PREFIX,
  MODULE_GRAPH_TOKEN,
  DEPENDENCY_MONITOR_OPTIONS,
} from './circular-dependency/constants';
