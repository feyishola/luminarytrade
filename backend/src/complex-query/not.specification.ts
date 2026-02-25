import {
  Specification,
  QueryContext,
  SpecificationQuery,
} from '../specification.abstract';

/**
 * Negates a specification.
 * Wraps the inner WHERE clause in NOT(...).
 */
export class NotSpecification<T> extends Specification<T> {
  readonly inner: Specification<T>;

  constructor(inner: Specification<T>) {
    super({
      name: `NOT(${inner.metadata.name})`,
      requiredRelations: inner.metadata.requiredRelations,
    });
    this.inner = inner;
  }

  toQuery(context: QueryContext): SpecificationQuery {
    const innerQuery = this.inner.toQuery(context);

    return {
      where: innerQuery.where ? `NOT (${innerQuery.where})` : undefined,
      parameters: innerQuery.parameters,
      joins: innerQuery.joins,
      // Order and select pass through unchanged
      orderBy: innerQuery.orderBy,
      select: innerQuery.select,
    };
  }

  isSatisfiedBy(candidate: Partial<T>): boolean {
    return !this.inner.isSatisfiedBy(candidate);
  }

  describe(): string {
    return `NOT (${this.inner.describe()})`;
  }
}
