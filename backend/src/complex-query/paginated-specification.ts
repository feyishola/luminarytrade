import { SelectQueryBuilder } from 'typeorm';
import {
  Specification,
  QueryContext,
  SpecificationQuery,
  PaginationOptions,
} from './specification.abstract';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Wraps a specification with pagination metadata.
 * Used by SpecificationExecutor to apply LIMIT/OFFSET automatically.
 */
export class PaginatedSpecification<T> extends Specification<T> {
  readonly inner: Specification<T>;
  readonly pagination: PaginationOptions;

  constructor(inner: Specification<T>, pagination: PaginationOptions) {
    super({
      name: `Paginated(${inner.metadata.name})`,
      requiredRelations: inner.metadata.requiredRelations,
      indexHints: inner.metadata.indexHints,
    });
    this.inner = inner;
    this.pagination = pagination;
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return this.inner.toQuery(context);
  }

  applyTo<E>(
    qb: SelectQueryBuilder<E>,
    context?: Partial<QueryContext>,
  ): SelectQueryBuilder<E> {
    const applied = super.applyTo(qb, context);
    const { page, limit } = this.pagination;
    const offset = (page - 1) * limit;
    return applied.skip(offset).take(limit);
  }

  isSatisfiedBy(candidate: Partial<T>): boolean {
    return this.inner.isSatisfiedBy(candidate);
  }

  describe(): string {
    return `${this.inner.describe()} [page=${this.pagination.page}, limit=${this.pagination.limit}]`;
  }

  /** Change pagination parameters */
  withPage(page: number): PaginatedSpecification<T> {
    return new PaginatedSpecification(this.inner, { ...this.pagination, page });
  }

  withLimit(limit: number): PaginatedSpecification<T> {
    return new PaginatedSpecification(this.inner, { ...this.pagination, limit });
  }
}
