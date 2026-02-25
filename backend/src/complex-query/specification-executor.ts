import { Injectable, Logger } from '@nestjs/common';
import {
  Repository,
  DataSource,
  EntityTarget,
  SelectQueryBuilder,
  ObjectLiteral,
} from 'typeorm';
import { Specification, QueryContext } from './specification.abstract';
import {
  PaginatedSpecification,
  PaginatedResult,
} from './paginated-specification';
import { SpecificationCache } from '../cache/specification-cache';
import { SpecificationValidator } from '../validation/specification-validator';

export interface ExecutionOptions {
  explain?: boolean;
  logQuery?: boolean;
  cacheKey?: string;
  cacheTtlMs?: number;
  indexHints?: string[];
}

export interface ExplainResult {
  plan: unknown;
  estimatedRows: number;
  estimatedCost: number;
  warnings: string[];
}

/**
 * Core executor that bridges Specification objects with TypeORM.
 *
 * @example
 * const agents = await executor.execute(
 *   new ActiveAgentsSpec()
 *     .and(new HighScoreAgentsSpec(80))
 *     .paginate(1, 20),
 *   Agent,
 * );
 */
@Injectable()
export class SpecificationExecutor {
  private readonly logger = new Logger(SpecificationExecutor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cache: SpecificationCache,
    private readonly validator: SpecificationValidator,
  ) {}

  /**
   * Execute a specification against a given entity, returning all matches.
   */
  async execute<T extends ObjectLiteral>(
    spec: Specification<T>,
    entity: EntityTarget<T>,
    options: ExecutionOptions = {},
  ): Promise<T[]> {
    const cacheKey = options.cacheKey ?? this.buildCacheKey(spec, entity);

    if (options.cacheKey) {
      const cached = await this.cache.get<T[]>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for specification: ${spec.metadata.name}`);
        return cached;
      }
    }

    const validationResult = this.validator.validate(spec);
    if (!validationResult.isValid) {
      throw new Error(
        `Specification validation failed: ${validationResult.errors.join(', ')}`,
      );
    }
    if (validationResult.warnings.length) {
      validationResult.warnings.forEach((w) =>
        this.logger.warn(`[Spec Warning] ${w}`),
      );
    }

    const qb = this.buildQueryBuilder(spec, entity, options);

    if (options.explain) {
      await this.explainQuery(qb);
    }

    if (options.logQuery) {
      this.logger.debug(`[Spec Query] ${qb.getSql()}`);
    }

    const result = await qb.getMany();

    if (options.cacheKey) {
      await this.cache.set(cacheKey, result, options.cacheTtlMs);
    }

    return result;
  }

  /**
   * Execute a paginated specification — returns paginated metadata alongside results.
   */
  async executePaginated<T extends ObjectLiteral>(
    spec: PaginatedSpecification<T>,
    entity: EntityTarget<T>,
    options: ExecutionOptions = {},
  ): Promise<PaginatedResult<T>> {
    const validationResult = this.validator.validate(spec);
    if (!validationResult.isValid) {
      throw new Error(
        `Specification validation failed: ${validationResult.errors.join(', ')}`,
      );
    }

    const qb = this.buildQueryBuilder(spec, entity, options);

    if (options.logQuery) {
      this.logger.debug(`[PaginatedSpec Query] ${qb.getSql()}`);
    }

    const [data, total] = await qb.getManyAndCount();
    const { page, limit } = spec.pagination;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Execute a specification and return a single result or null.
   */
  async executeOne<T extends ObjectLiteral>(
    spec: Specification<T>,
    entity: EntityTarget<T>,
    options: ExecutionOptions = {},
  ): Promise<T | null> {
    const qb = this.buildQueryBuilder(spec, entity, options);
    return qb.getOne();
  }

  /**
   * Execute only a count query.
   */
  async executeCount<T extends ObjectLiteral>(
    spec: Specification<T>,
    entity: EntityTarget<T>,
  ): Promise<number> {
    const qb = this.buildQueryBuilder(spec, entity);
    return qb.getCount();
  }

  /**
   * Check whether any entity satisfies the specification.
   */
  async executeExists<T extends ObjectLiteral>(
    spec: Specification<T>,
    entity: EntityTarget<T>,
  ): Promise<boolean> {
    const count = await this.executeCount(spec, entity);
    return count > 0;
  }

  /**
   * Build a raw QueryBuilder from a specification without executing it.
   * Useful for further customisation before execution.
   */
  buildQueryBuilder<T extends ObjectLiteral>(
    spec: Specification<T>,
    entity: EntityTarget<T>,
    options: ExecutionOptions = {},
  ): SelectQueryBuilder<T> {
    const repo: Repository<T> = this.dataSource.getRepository(entity);
    const alias = this.inferAlias(entity);
    const qb = repo.createQueryBuilder(alias);

    const context: QueryContext = {
      alias,
      addedJoins: new Set(),
      parameterIndex: 0,
      hints: options.indexHints ?? spec.metadata.indexHints,
    };

    spec.applyTo(qb, context);
    return qb;
  }

  private async explainQuery<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
  ): Promise<void> {
    try {
      const sql = `EXPLAIN ANALYZE ${qb.getSql()}`;
      const result = await this.dataSource.query(sql, qb.getParameters() as unknown[]);
      this.logger.debug('[Query Plan]', JSON.stringify(result, null, 2));
    } catch (err) {
      this.logger.warn('Could not obtain query plan', err);
    }
  }

  private buildCacheKey<T>(spec: Specification<T>, entity: EntityTarget<T>): string {
    const entityName =
      typeof entity === 'string'
        ? entity
        : (entity as { name?: string }).name ?? String(entity);
    return `spec:${entityName}:${spec.metadata.name}`;
  }

  private inferAlias(entity: EntityTarget<unknown>): string {
    if (typeof entity === 'string') return entity.toLowerCase();
    const name = (entity as { name?: string }).name;
    if (name) return name.charAt(0).toLowerCase() + name.slice(1);
    return 'entity';
  }
}
