import {
  Specification,
  QueryContext,
  SpecificationQuery,
} from '../core/specification.abstract';

/**
 * Filters entities that belong to a specific owner via a relation.
 * Handles the join automatically.
 *
 * @example
 * new RelatedToSpec('agent.owner', 'owner', 'id', userId)
 */
export class RelatedToSpec<T> extends Specification<T> {
  constructor(
    private readonly relation: string,   // e.g. 'agent.owner'
    private readonly joinAlias: string,  // e.g. 'owner'
    private readonly targetField: string, // e.g. 'id'
    private readonly targetValue: string | number,
    private readonly joinType: 'inner' | 'left' = 'inner',
  ) {
    super({
      name: `RelatedTo(${relation}.${targetField}=${targetValue})`,
      description: `Entities where ${relation}.${targetField} = ${targetValue}`,
      requiredRelations: [relation],
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    const paramName = `relatedToValue_${this.joinAlias}`;
    return {
      joins: [
        {
          type: this.joinType,
          relation: this.relation,
          alias: this.joinAlias,
        },
      ],
      where: `${this.joinAlias}.${this.targetField} = :${paramName}`,
      parameters: { [paramName]: this.targetValue },
    };
  }
}

/**
 * Filters entities owned by a specific user ID.
 * Assumes entity has a direct ownerId foreign key column.
 */
export class OwnedBySpec<T extends { ownerId: string }> extends Specification<T> {
  constructor(private readonly userId: string) {
    super({
      name: `OwnedBy(${userId})`,
      description: `Entities owned by user ${userId}`,
      indexHints: ['idx_owner_id'],
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.ownerId = :ownedByUserId`,
      parameters: { ownedByUserId: this.userId },
    };
  }

  isSatisfiedBy(candidate: Partial<T>): boolean {
    return (candidate as { ownerId: string }).ownerId === this.userId;
  }
}
