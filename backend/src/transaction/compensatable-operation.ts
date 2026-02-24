import { EntityManager } from 'typeorm';
import { ICompensatableOperation } from './interfaces/unit-of-work.interface';

export abstract class CompensatableOperation implements ICompensatableOperation {
  protected executed: boolean = false;
  protected executionResult?: any;
  protected compensationData?: any;

  constructor(private readonly operationName: string) {}

  getName(): string {
    return this.operationName;
  }

  async execute(manager: EntityManager): Promise<any> {
    if (this.executed) {
      throw new Error(`Operation ${this.operationName} has already been executed`);
    }

    try {
      this.executionResult = await this.doExecute(manager);
      this.executed = true;
      return this.executionResult;
    } catch (error) {
      throw new Error(
        `Operation ${this.operationName} failed: ${(error as Error).message}`,
      );
    }
  }

  async compensate(manager: EntityManager): Promise<void> {
    if (!this.executed) {
      // Nothing to compensate if not executed
      return;
    }

    try {
      await this.doCompensate(manager);
    } catch (error) {
      throw new Error(
        `Compensation for ${this.operationName} failed: ${(error as Error).message}`,
      );
    }
  }

  isExecuted(): boolean {
    return this.executed;
  }

  getExecutionResult(): any {
    return this.executionResult;
  }

  protected abstract doExecute(manager: EntityManager): Promise<any>;
  protected abstract doCompensate(manager: EntityManager): Promise<void>;
}

export class InsertOperation extends CompensatableOperation {
  constructor(
    name: string,
    private readonly entityClass: any,
    private readonly data: any,
    private readonly idField: string = 'id',
  ) {
    super(name);
  }

  protected async doExecute(manager: EntityManager): Promise<any> {
    const repository = manager.getRepository(this.entityClass);
    const entity = repository.create(this.data);
    const saved = await repository.save(entity);
    this.compensationData = { [this.idField]: saved[this.idField] };
    return saved;
  }

  protected async doCompensate(manager: EntityManager): Promise<void> {
    if (this.compensationData) {
      const repository = manager.getRepository(this.entityClass);
      await repository.delete(this.compensationData);
    }
  }
}

export class UpdateOperation extends CompensatableOperation {
  constructor(
    name: string,
    private readonly entityClass: any,
    private readonly criteria: any,
    private readonly newData: any,
  ) {
    super(name);
  }

  protected async doExecute(manager: EntityManager): Promise<any> {
    const repository = manager.getRepository(this.entityClass);
    
    // Store original data for compensation
    const existing = await repository.findOne({ where: this.criteria });
    if (existing) {
      this.compensationData = { ...existing };
    }
    
    await repository.update(this.criteria, this.newData);
    return repository.findOne({ where: this.criteria });
  }

  protected async doCompensate(manager: EntityManager): Promise<void> {
    if (this.compensationData) {
      const repository = manager.getRepository(this.entityClass);
      const { id, ...dataToRestore } = this.compensationData;
      await repository.update(this.criteria, dataToRestore);
    }
  }
}

export class DeleteOperation extends CompensatableOperation {
  constructor(
    name: string,
    private readonly entityClass: any,
    private readonly criteria: any,
  ) {
    super(name);
  }

  protected async doExecute(manager: EntityManager): Promise<any> {
    const repository = manager.getRepository(this.entityClass);
    
    // Store deleted data for compensation
    const existing = await repository.findOne({ where: this.criteria });
    if (existing) {
      this.compensationData = { ...existing };
      await repository.delete(this.criteria);
    }
    
    return existing;
  }

  protected async doCompensate(manager: EntityManager): Promise<void> {
    if (this.compensationData) {
      const repository = manager.getRepository(this.entityClass);
      const entity = repository.create(this.compensationData);
      await repository.save(entity);
    }
  }
}

export class CustomOperation extends CompensatableOperation {
  constructor(
    name: string,
    private readonly executeFn: (manager: EntityManager) => Promise<any>,
    private readonly compensateFn: (manager: EntityManager, executionResult: any) => Promise<void>,
  ) {
    super(name);
  }

  protected async doExecute(manager: EntityManager): Promise<any> {
    const result = await this.executeFn(manager);
    this.compensationData = result;
    return result;
  }

  protected async doCompensate(manager: EntityManager): Promise<void> {
    await this.compensateFn(manager, this.compensationData);
  }
}
