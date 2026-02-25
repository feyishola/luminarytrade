import {
  Specification,
  QueryContext,
  SpecificationQuery,
} from '../core/specification.abstract';

export interface HasIsActive {
  isActive: boolean;
}

/**
 * Generic specification that filters entities with isActive = true.
 * Works with any entity that has an `isActive` column.
 */
export class ActiveEntitiesSpec<T extends HasIsActive> extends Specification<T> {
  constructor(private readonly activeField = 'isActive') {
    super({
      name: 'ActiveEntities',
      description: 'Filters only active entities',
      indexHints: ['idx_is_active'],
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.${this.activeField} = :activeEntitiesIsActive`,
      parameters: { activeEntitiesIsActive: true },
    };
  }

  isSatisfiedBy(candidate: Partial<T>): boolean {
    return (candidate as HasIsActive).isActive === true;
  }
}
