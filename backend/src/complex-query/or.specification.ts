import {
  Specification,
  QueryContext,
  SpecificationQuery,
} from '../specification.abstract';

/**
 * Combines two specifications with a logical OR.
 * Either side being satisfied makes the composite pass.
 */
export class OrSpecification<T> extends Specification<T> {
  readonly left: Specification<T>;
  readonly right: Specification<T>;

  constructor(left: Specification<T>, right: Specification<T>) {
    super({
      name: `(${left.metadata.name} OR ${right.metadata.name})`,
      requiredRelations: [
        ...(left.metadata.requiredRelations ?? []),
        ...(right.metadata.requiredRelations ?? []),
      ],
    });
    this.left = left;
    this.right = right;
  }

  toQuery(context: QueryContext): SpecificationQuery {
    const leftQuery = this.left.toQuery(context);
    const rightQuery = this.right.toQuery(context);

    const mergedJoins = [...(leftQuery.joins ?? []), ...(rightQuery.joins ?? [])];
    const deduplicatedJoins = mergedJoins.filter(
      (join, index, self) =>
        index === self.findIndex((j) => j.alias === join.alias),
    );

    const whereClauses: string[] = [];
    if (leftQuery.where) whereClauses.push(`(${leftQuery.where})`);
    if (rightQuery.where) whereClauses.push(`(${rightQuery.where})`);

    return {
      where: whereClauses.length ? whereClauses.join(' OR ') : undefined,
      parameters: {
        ...(leftQuery.parameters ?? {}),
        ...(rightQuery.parameters ?? {}),
      },
      joins: deduplicatedJoins.length ? deduplicatedJoins : undefined,
      orderBy: [
        ...(leftQuery.orderBy ?? []),
        ...(rightQuery.orderBy ?? []),
      ],
    };
  }

  isSatisfiedBy(candidate: Partial<T>): boolean {
    return (
      this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate)
    );
  }

  describe(): string {
    return `(${this.left.describe()} OR ${this.right.describe()})`;
  }
}
