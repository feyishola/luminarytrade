import { Repository } from 'typeorm';
import { ServiceContract } from '../../common/services/base-service.interface';

/**
 * Base repository contract interface
 * Defines contract for all repository implementations
 * Ensures Liskov Substitution Principle compliance for data access layers
 */
export interface IBaseRepository<T> {
  /**
   * Find entity by ID
   * @param id Entity ID
   * @returns Entity or null if not found
   */
  findById(id: string): Promise<T | null>;
  
  /**
   * Find all entities with optional filters
   * @param filters Optional filter criteria
   * @returns Array of entities
   */
  findAll(filters?: Record<string, any>): Promise<T[]>;
  
  /**
   * Create new entity
   * @param entity Entity data
   * @returns Created entity
   */
  create(entity: Partial<T>): Promise<T>;
  
  /**
   * Update existing entity
   * @param id Entity ID
   * @param updates Update data
   * @returns Updated entity
   */
  update(id: string, updates: Partial<T>): Promise<T>;
  
  /**
   * Delete entity
   * @param id Entity ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;
  
  /**
   * Check if entity exists
   * @param id Entity ID
   * @returns true if exists, false otherwise
   */
  exists(id: string): Promise<boolean>;
  
  /**
   * Count entities with optional filters
   * @param filters Optional filter criteria
   * @returns Entity count
   */
  count(filters?: Record<string, any>): Promise<number>;
}

/**
 * Repository contract specification
 * Defines behavioral contracts for all repository implementations
 */
export const REPOSITORY_CONTRACT: ServiceContract = {
  method: 'findById',
  preconditions: [
    'arg0 != null',
    'typeof arg0 === "string"',
    'arg0.length > 0'
  ],
  postconditions: [
    'result === null || typeof result === "object"',
    'result === null || result.id === arg0'
  ],
  invariants: [
    'this.constructor.name != null'
  ],
  exceptions: [
    {
      type: 'RepositoryError',
      condition: 'error.code === "DATABASE_ERROR"',
      recovery: 'Retry operation or failover to backup database'
    },
    {
      type: 'RepositoryError',
      condition: 'error.code === "CONNECTION_FAILED"',
      recovery: 'Reconnect to database and retry'
    }
  ],
  performance: {
    expectedLatency: '10ms',
    maxLatency: '100ms',
    throughput: '1000 requests/second'
  }
};

/**
 * Repository error types
 */
export class RepositoryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export enum RepositoryErrorCode {
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED'
}

/**
 * Base repository implementation
 * Provides common repository functionality with contract enforcement
 */
export abstract class BaseRepository<T> implements IBaseRepository<T> {
  protected readonly entityName: string;
  
  constructor(
    protected readonly repository: Repository<T>,
    entityName: string
  ) {
    this.entityName = entityName;
  }

  async findById(id: string): Promise<T | null> {
    try {
      this.validateId(id);
      return await this.repository.findOne({ where: { id } as any });
    } catch (error) {
      throw this.createRepositoryError(
        RepositoryErrorCode.DATABASE_ERROR,
        `Failed to find ${this.entityName} by ID: ${id}`,
        { id, error }
      );
    }
  }

  async findAll(filters?: Record<string, any>): Promise<T[]> {
    try {
      return await this.repository.find({ where: filters as any });
    } catch (error) {
      throw this.createRepositoryError(
        RepositoryErrorCode.DATABASE_ERROR,
        `Failed to find all ${this.entityName}`,
        { filters, error }
      );
    }
  }

  async create(entity: Partial<T>): Promise<T> {
    try {
      this.validateEntity(entity);
      const newEntity = this.repository.create(entity);
      return await this.repository.save(newEntity);
    } catch (error) {
      throw this.createRepositoryError(
        RepositoryErrorCode.DATABASE_ERROR,
        `Failed to create ${this.entityName}`,
        { entity, error }
      );
    }
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    try {
      this.validateId(id);
      this.validateEntity(updates);
      
      const existing = await this.findById(id);
      if (!existing) {
        throw this.createRepositoryError(
          RepositoryErrorCode.ENTITY_NOT_FOUND,
          `${this.entityName} with ID ${id} not found`
        );
      }
      
      Object.assign(existing, updates);
      return await this.repository.save(existing);
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      
      throw this.createRepositoryError(
        RepositoryErrorCode.DATABASE_ERROR,
        `Failed to update ${this.entityName} with ID: ${id}`,
        { id, updates, error }
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      this.validateId(id);
      
      const result = await this.repository.delete(id as any);
      return result.affected > 0;
    } catch (error) {
      throw this.createRepositoryError(
        RepositoryErrorCode.DATABASE_ERROR,
        `Failed to delete ${this.entityName} with ID: ${id}`,
        { id, error }
      );
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      this.validateId(id);
      const count = await this.repository.count({ where: { id } as any });
      return count > 0;
    } catch (error) {
      throw this.createRepositoryError(
        RepositoryErrorCode.DATABASE_ERROR,
        `Failed to check if ${this.entityName} exists: ${id}`,
        { id, error }
      );
    }
  }

  async count(filters?: Record<string, any>): Promise<number> {
    try {
      return await this.repository.count({ where: filters as any });
    } catch (error) {
      throw this.createRepositoryError(
        RepositoryErrorCode.DATABASE_ERROR,
        `Failed to count ${this.entityName}`,
        { filters, error }
      );
    }
  }

  /**
   * Execute operation within transaction
   */
  async withTransaction<R>(operation: () => Promise<R>): Promise<R> {
    const queryRunner = this.repository.manager.connection.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      const result = await operation();
      
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw this.createRepositoryError(
        RepositoryErrorCode.TRANSACTION_FAILED,
        'Transaction failed',
        { error }
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validation methods
   */
  protected validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.length === 0) {
      throw this.createRepositoryError(
        RepositoryErrorCode.VALIDATION_ERROR,
        'Invalid ID provided'
      );
    }
  }

  protected validateEntity(entity: Partial<T>): void {
    if (!entity || typeof entity !== 'object') {
      throw this.createRepositoryError(
        RepositoryErrorCode.VALIDATION_ERROR,
        'Invalid entity data provided'
      );
    }
  }

  protected createRepositoryError(
    code: RepositoryErrorCode,
    message: string,
    details?: any
  ): RepositoryError {
    return new RepositoryError(code, message, details);
  }
}