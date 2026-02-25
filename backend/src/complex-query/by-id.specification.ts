import {
  Specification,
  QueryContext,
  SpecificationQuery,
} from '../core/specification.abstract';

export interface HasId {
  id: string | number;
}

/**
 * Generic specification that filters by primary key.
 */
export class ByIdSpec<T extends HasId> extends Specification<T> {
  constructor(private readonly id: string | number) {
    super({
      name: `ById(${id})`,
      description: `Filter by primary key: ${id}`,
      indexHints: ['PRIMARY'],
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.id = :byIdValue`,
      parameters: { byIdValue: this.id },
    };
  }

  isSatisfiedBy(candidate: Partial<T>): boolean {
    return (candidate as HasId).id === this.id;
  }
}
