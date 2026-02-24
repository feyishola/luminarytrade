import { EntityManager } from 'typeorm';

export interface ICompensatableOperation {
  execute(manager: EntityManager): Promise<any>;
  compensate(manager: EntityManager): Promise<void>;
  getName(): string;
}

export interface ITransactionContext {
  readonly id: string;
  readonly manager: EntityManager;
  readonly parentContext?: ITransactionContext;
  readonly depth: number;
  
  registerOperation(operation: ICompensatableOperation): void;
  getOperations(): ICompensatableOperation[];
  isNested(): boolean;
}

export interface IUnitOfWork {
  begin(): Promise<ITransactionContext>;
  commit(context: ITransactionContext): Promise<void>;
  rollback(context: ITransactionContext, error?: Error): Promise<void>;
  execute<T>(
    work: (context: ITransactionContext) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>;
}

export interface TransactionOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  exponentialBackoff?: boolean;
  maxBackoffMs?: number;
  timeoutMs?: number;
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  readOnly?: boolean;
}

export interface TransactionMetrics {
  transactionId: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  success: boolean;
  retryCount: number;
  operationsCount: number;
  error?: string;
}

export type TransactionHook = (
  context: ITransactionContext,
  metrics?: TransactionMetrics,
) => Promise<void> | void;

export interface TransactionHooks {
  beforeBegin?: TransactionHook;
  afterBegin?: TransactionHook;
  beforeCommit?: TransactionHook;
  afterCommit?: TransactionHook;
  beforeRollback?: TransactionHook;
  afterRollback?: TransactionHook;
  onRetry?: (context: ITransactionContext, attempt: number, error: Error) => Promise<void> | void;
}
