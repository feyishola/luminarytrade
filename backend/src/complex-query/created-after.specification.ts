import {
  Specification,
  QueryContext,
  SpecificationQuery,
} from '../core/specification.abstract';

export interface HasCreatedAt {
  createdAt: Date;
}

/**
 * Filters entities created after a given timestamp.
 */
export class CreatedAfterSpec<T extends HasCreatedAt> extends Specification<T> {
  constructor(private readonly since: Date) {
    super({
      name: `CreatedAfter(${since.toISOString()})`,
      description: `Entities created after ${since.toISOString()}`,
      indexHints: ['idx_created_at'],
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.createdAt > :createdAfterSince`,
      parameters: { createdAfterSince: this.since },
    };
  }

  isSatisfiedBy(candidate: Partial<T>): boolean {
    const created = (candidate as HasCreatedAt).createdAt;
    return created != null && created > this.since;
  }
}

/**
 * Filters entities updated within the last N days.
 */
export class UpdatedWithinDaysSpec<
  T extends { updatedAt: Date },
> extends Specification<T> {
  private readonly since: Date;

  constructor(private readonly days: number) {
    super({
      name: `UpdatedWithinDays(${days})`,
      description: `Entities updated within the last ${days} days`,
      indexHints: ['idx_updated_at'],
    });
    this.since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.updatedAt > :updatedWithinSince`,
      parameters: { updatedWithinSince: this.since },
    };
  }

  isSatisfiedBy(candidate: Partial<T>): boolean {
    const updated = (candidate as { updatedAt: Date }).updatedAt;
    return updated != null && updated > this.since;
  }
}
