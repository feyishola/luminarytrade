import { Injectable, Logger } from '@nestjs/common';
import { TransactionMetrics, TransactionHooks, ITransactionContext } from './interfaces/unit-of-work.interface';

export interface TransactionEvent {
  type: 'begin' | 'commit' | 'rollback' | 'retry' | 'timeout';
  transactionId: string;
  timestamp: Date;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class TransactionMonitorService {
  private readonly logger = new Logger(TransactionMonitorService.name);
  private readonly events: TransactionEvent[] = [];
  private readonly metrics: Map<string, TransactionMetrics> = new Map();
  private readonly listeners: Set<(event: TransactionEvent) => void> = new Set();
  private maxEventsHistory: number = 1000;

  createHooks(): TransactionHooks {
    return {
      beforeBegin: async (context: ITransactionContext) => {
        this.recordEvent({
          type: 'begin',
          transactionId: context.id,
          timestamp: new Date(),
        });
        this.logger.debug(`Transaction ${context.id} beginning (depth: ${context.depth})`);
      },

      afterCommit: async (context: ITransactionContext, metrics?: TransactionMetrics) => {
        this.recordEvent({
          type: 'commit',
          transactionId: context.id,
          timestamp: new Date(),
          durationMs: metrics?.durationMs,
        });
        if (metrics) {
          this.metrics.set(context.id, metrics);
        }
        this.logger.log(`Transaction ${context.id} committed successfully`);
      },

      afterRollback: async (context: ITransactionContext, metrics?: TransactionMetrics) => {
        this.recordEvent({
          type: 'rollback',
          transactionId: context.id,
          timestamp: new Date(),
          durationMs: metrics?.durationMs,
          error: metrics?.error,
        });
        if (metrics) {
          this.metrics.set(context.id, metrics);
        }
        this.logger.warn(`Transaction ${context.id} rolled back: ${metrics?.error || 'Unknown error'}`);
      },

      onRetry: async (context: ITransactionContext, attempt: number, error: Error) => {
        this.recordEvent({
          type: 'retry',
          transactionId: context.id,
          timestamp: new Date(),
          metadata: { attempt, error: error.message },
        });
        this.logger.warn(`Transaction ${context.id} retry attempt ${attempt}: ${error.message}`);
      },
    };
  }

  recordEvent(event: TransactionEvent): void {
    this.events.push(event);
    
    // Trim history if it exceeds max size
    if (this.events.length > this.maxEventsHistory) {
      this.events.shift();
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.logger.error('Error in transaction event listener:', error);
      }
    });
  }

  subscribe(listener: (event: TransactionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEvents(filter?: {
    transactionId?: string;
    type?: TransactionEvent['type'];
    startTime?: Date;
    endTime?: Date;
  }): TransactionEvent[] {
    let filtered = [...this.events];

    if (filter?.transactionId) {
      filtered = filtered.filter((e) => e.transactionId === filter.transactionId);
    }

    if (filter?.type) {
      filtered = filtered.filter((e) => e.type === filter.type);
    }

    if (filter?.startTime) {
      filtered = filtered.filter((e) => e.timestamp >= filter.startTime!);
    }

    if (filter?.endTime) {
      filtered = filtered.filter((e) => e.timestamp <= filter.endTime!);
    }

    return filtered;
  }

  getMetrics(transactionId: string): TransactionMetrics | undefined {
    return this.metrics.get(transactionId);
  }

  getAllMetrics(): TransactionMetrics[] {
    return Array.from(this.metrics.values());
  }

  getStatistics(): {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    averageDurationMs: number;
    retryRate: number;
  } {
    const allMetrics = this.getAllMetrics();
    const total = allMetrics.length;
    const successful = allMetrics.filter((m) => m.success).length;
    const failed = total - successful;
    const totalDuration = allMetrics.reduce((sum, m) => sum + (m.durationMs || 0), 0);
    const totalRetries = allMetrics.reduce((sum, m) => sum + m.retryCount, 0);

    return {
      totalTransactions: total,
      successfulTransactions: successful,
      failedTransactions: failed,
      averageDurationMs: total > 0 ? totalDuration / total : 0,
      retryRate: total > 0 ? totalRetries / total : 0,
    };
  }

  clearHistory(): void {
    this.events.length = 0;
    this.metrics.clear();
  }

  setMaxEventsHistory(max: number): void {
    this.maxEventsHistory = max;
    // Trim immediately if needed
    while (this.events.length > max) {
      this.events.shift();
    }
  }

  exportMetrics(): string {
    return JSON.stringify(
      {
        statistics: this.getStatistics(),
        metrics: this.getAllMetrics(),
        events: this.events,
      },
      null,
      2,
    );
  }
}
