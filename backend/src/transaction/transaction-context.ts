import { EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ITransactionContext, ICompensatableOperation } from './interfaces/unit-of-work.interface';

export class TransactionContext implements ITransactionContext {
  readonly id: string;
  readonly manager: EntityManager;
  readonly parentContext?: ITransactionContext;
  readonly depth: number;
  private readonly operations: ICompensatableOperation[] = [];
  private completed: boolean = false;

  constructor(
    manager: EntityManager,
    parentContext?: ITransactionContext,
    id?: string,
  ) {
    this.id = id || uuidv4();
    this.manager = manager;
    this.parentContext = parentContext;
    this.depth = parentContext ? parentContext.depth + 1 : 0;
  }

  registerOperation(operation: ICompensatableOperation): void {
    if (this.completed) {
      throw new Error(`Cannot register operation on completed transaction ${this.id}`);
    }
    this.operations.push(operation);
  }

  getOperations(): ICompensatableOperation[] {
    return [...this.operations];
  }

  isNested(): boolean {
    return this.depth > 0;
  }

  markCompleted(): void {
    this.completed = true;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  async executeCompensation(): Promise<void> {
    // Execute compensation in reverse order (LIFO)
    const reversedOperations = [...this.operations].reverse();
    
    for (const operation of reversedOperations) {
      try {
        await operation.compensate(this.manager);
      } catch (error) {
        // Log compensation failure but continue with other compensations
        console.error(`Compensation failed for operation ${operation.getName()}:`, error);
      }
    }
  }
}
