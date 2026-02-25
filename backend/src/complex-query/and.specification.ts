import {
  Specification,
  QueryContext,
  SpecificationQuery,
} from '../specification.abstract';

/**
 * Combines two specifications with a logical AND.
 * Both sides must be satisfied for the composite to pass.
 */
export class AndSpecification<T> extends Specification<T> {
  readonly left: Specification<T>;
  readonly right: Specification<T>;

  constructor(left: Specification<T>, right: Specification<T>) {
    super({
      name: `(${left.metadata.name} AND ${right.metadata.name})`,
      requiredRelations: [
        ...(left.metadata.requiredRelations ?? []),
        ...(right.metadata.requiredRelations ?? []),
      ],
      indexHints: [
        ...(left.metadata.indexHints ?? []),
        ...(right.metadata.indexHints ?? []),
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
      where: whereClauses.length ? whereClauses.join(' AND ') : undefined,
      parameters: {
        ...(leftQuery.parameters ?? {}),
        ...(rightQuery.parameters ?? {}),
      },
      joins: deduplicatedJoins.length ? deduplicatedJoins : undefined,
      orderBy: [
        ...(leftQuery.orderBy ?? []),
        ...(rightQuery.orderBy ?? []),
      ],
      select: [
        ...(leftQuery.select ?? []),
        ...(rightQuery.select ?? []),
      ],
    };
  }

  isSatisfiedBy(candidate: Partial<T>): boolean {
    return (
      this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate)
    );
  }

  describe(): string {
    return `(${this.left.describe()} AND ${this.right.describe()})`;
  }

  /** Collect all leaf specifications in this AND tree */
  flatten(): Specification<T>[] {
    const specs: Specification<T>[] = [];
    const collect = (spec: Specification<T>) => {
      if (spec instanceof AndSpecification) {
        collect(spec.left);
        collect(spec.right);
      } else {
        specs.push(spec);
      }
    };
    collect(this);
    return specs;
  }
}
