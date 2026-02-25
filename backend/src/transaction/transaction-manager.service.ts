import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, IsolationLevel } from 'typeorm';
import { TransactionContext } from './transaction-context';
import {
  IUnitOfWork,
  ITransactionContext,
  TransactionOptions,
  TransactionHooks,
  TransactionMetrics,
} from './interfaces/unit-of-work.interface';

@Injectable()
export class TransactionManager implements IUnitOfWork {
  private readonly logger = new Logger(TransactionManager.name);
  private readonly hooks: TransactionHooks = {};
  private readonly metrics: Map<string, TransactionMetrics> = new Map();
  private readonly activeContexts: Map<string, TransactionContext> = new Map();

  constructor(private readonly dataSource: DataSource) {}

  registerHooks(hooks: TransactionHooks): void {
    (Object.keys(hooks) as (keyof TransactionHooks)[]).forEach((key) => {
      const nextHook = hooks[key];
      if (!nextHook) return;

      const existing = this.hooks[key];
      if (!existing) {
        this.hooks[key] = nextHook;
        return;
      }

      if (key === 'onRetry') {
        this.hooks.onRetry = async (context, attempt, error) => {
          await existing(context as any, attempt as any, error as any);
          await nextHook(context as any, attempt as any, error as any);
        };
        return;
      }

      this.hooks[key] = async (context, metrics) => {
        await (existing as any)(context, metrics);
        await (nextHook as any)(context, metrics);
      };
    });
  }

  async begin(parentContext?: ITransactionContext): Promise<ITransactionContext> {
    const contextId = this.generateContextId();
    
    if (this.hooks.beforeBegin) {
      await this.hooks.beforeBegin(parentContext as ITransactionContext);
    }

    // For nested transactions, we use the parent's manager (savepoint semantics)
    if (parentContext) {
      const nestedContext = new TransactionContext(
        parentContext.manager,
        parentContext,
        contextId,
      );
      this.activeContexts.set(contextId, nestedContext);
      
      if (this.hooks.afterBegin) {
        await this.hooks.afterBegin(nestedContext);
      }
      
      return nestedContext;
    }

    // For root transactions, TypeORM handles the actual transaction
    // The manager will be provided when execute() is called
    const context = new TransactionContext(null as any, undefined, contextId);
    this.activeContexts.set(contextId, context);
    
    if (this.hooks.afterBegin) {
      await this.hooks.afterBegin(context);
    }
    
    return context;
  }

  async commit(context: ITransactionContext): Promise<void> {
    const ctx = this.activeContexts.get(context.id);
    if (!ctx) {
      throw new Error(`Transaction context ${context.id} not found`);
    }

    if (ctx.isCompleted()) {
      throw new Error(`Transaction ${context.id} is already completed`);
    }

    if (this.hooks.beforeCommit) {
      await this.hooks.beforeCommit(context, this.metrics.get(context.id));
    }

    // For nested transactions, we don't actually commit yet
    // The parent transaction will handle the final commit
    if (ctx.isNested()) {
      ctx.markCompleted();
      return;
    }

    // Root transaction commit is handled by TypeORM's transaction method
    ctx.markCompleted();
    this.activeContexts.delete(context.id);
    
    if (this.hooks.afterCommit) {
      await this.hooks.afterCommit(context, this.metrics.get(context.id));
    }
  }

  async rollback(context: ITransactionContext, error?: Error): Promise<void> {
    const ctx = this.activeContexts.get(context.id);
    if (!ctx) {
      throw new Error(`Transaction context ${context.id} not found`);
    }

    if (ctx.isCompleted()) {
      return; // Already completed, nothing to rollback
    }

    if (this.hooks.beforeRollback) {
      await this.hooks.beforeRollback(context, this.metrics.get(context.id));
    }

    // Execute compensation for all registered operations
    await ctx.executeCompensation();

    ctx.markCompleted();
    this.activeContexts.delete(context.id);

    // Update metrics
    const metrics = this.metrics.get(context.id);
    if (metrics) {
      metrics.success = false;
      metrics.error = error?.message;
    }
    
    if (this.hooks.afterRollback) {
      await this.hooks.afterRollback(context, metrics);
    }
  }

  async execute<T>(
    work: (context: ITransactionContext) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    const {
      maxRetries = 3,
      retryDelayMs = 100,
      exponentialBackoff = true,
      maxBackoffMs = 10000,
      timeoutMs = 30000,
      isolationLevel = 'READ COMMITTED',
      readOnly = false,
    } = options;

    const contextId = this.generateContextId();
    const startTime = Date.now();
    
    const metrics: TransactionMetrics = {
      transactionId: contextId,
      startTime: new Date(),
      success: false,
      retryCount: 0,
      operationsCount: 0,
    };
    this.metrics.set(contextId, metrics);

    let lastError: Error | undefined;
    let failureCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          work,
          timeoutMs,
          isolationLevel,
          readOnly,
          contextId,
          metrics,
        );

        metrics.success = true;
        metrics.retryCount = failureCount;
        metrics.endTime = new Date();
        metrics.durationMs = Date.now() - startTime;
        
        return result;
      } catch (error) {
        lastError = error as Error;
        failureCount = attempt + 1;
        metrics.retryCount = failureCount;
        
        this.logger.warn(
          `Transaction ${contextId} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`,
        );

        if (attempt < maxRetries) {
          if (this.hooks.onRetry) {
            await this.hooks.onRetry(
              { id: contextId } as ITransactionContext,
              attempt + 1,
              lastError,
            );
          }

          const delay = exponentialBackoff
            ? Math.min(retryDelayMs * Math.pow(2, attempt), maxBackoffMs)
            : retryDelayMs;

          await this.sleep(delay);
        }
      }
    }

    metrics.endTime = new Date();
    metrics.durationMs = Date.now() - startTime;
    metrics.success = false;
    metrics.error = lastError?.message;
    metrics.retryCount = Math.max(failureCount - 1, 0);

    throw lastError || new Error(`Transaction ${contextId} failed after ${maxRetries + 1} attempts`);
  }

  private async executeWithTimeout<T>(
    work: (context: ITransactionContext) => Promise<T>,
    timeoutMs: number,
    isolationLevel: IsolationLevel,
    readOnly: boolean,
    contextId: string,
    metrics: TransactionMetrics,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Transaction ${contextId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.dataSource
        .transaction(
          {
            isolation: isolationLevel,
            readOnly,
          },
          async (manager) => {
            const context = new TransactionContext(manager, undefined, contextId);
            this.activeContexts.set(contextId, context);

            try {
              if (this.hooks.beforeBegin) {
                await this.hooks.beforeBegin(context);
              }
              if (this.hooks.afterBegin) {
                await this.hooks.afterBegin(context);
              }

              const result = await work(context);
              metrics.operationsCount = context.getOperations().length;

              if (this.hooks.beforeCommit) {
                await this.hooks.beforeCommit(context, metrics);
              }

              context.markCompleted();

              if (this.hooks.afterCommit) {
                await this.hooks.afterCommit(context, metrics);
              }

              return result;
            } catch (error) {
              // Execute compensation before throwing
              metrics.success = false;
              metrics.error = (error as Error).message;
              metrics.operationsCount = context.getOperations().length;

              if (this.hooks.beforeRollback) {
                await this.hooks.beforeRollback(context, metrics);
              }

              await context.executeCompensation();

              if (this.hooks.afterRollback) {
                await this.hooks.afterRollback(context, metrics);
              }
              throw error;
            } finally {
              this.activeContexts.delete(contextId);
            }
          },
        )
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  getMetrics(transactionId: string): TransactionMetrics | undefined {
    return this.metrics.get(transactionId);
  }

  getAllMetrics(): TransactionMetrics[] {
    return Array.from(this.metrics.values());
  }

  getActiveTransactions(): string[] {
    return Array.from(this.activeContexts.keys());
  }

  private generateContextId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
