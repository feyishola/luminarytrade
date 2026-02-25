// Transaction Management Module - Main exports

// Interfaces (types must use 'export type' for isolatedModules)
export type {
  ICompensatableOperation,
  ITransactionContext,
  IUnitOfWork,
  TransactionOptions,
  TransactionMetrics,
  TransactionHook,
  TransactionHooks,
} from './interfaces/unit-of-work.interface';

// Core classes
export { TransactionContext } from './transaction-context';
export { TransactionManager } from './transaction-manager.service';
export { TransactionMonitorService } from './transaction-monitor.service';
export type { TransactionEvent } from './transaction-monitor.service';

// Compensatable operations
export {
  CompensatableOperation,
  InsertOperation,
  UpdateOperation,
  DeleteOperation,
  CustomOperation,
} from './compensatable-operation';

// Module
export { TransactionModule } from './transaction.module';
