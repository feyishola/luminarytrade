import { SelectQueryBuilder } from 'typeorm';
import { AndSpecification } from './composite/and.specification';
import { OrSpecification } from './composite/or.specification';
import { NotSpecification } from './composite/not.specification';
import { PaginatedSpecification } from './paginated-specification';

export interface QueryContext {
  alias: string;
  addedJoins: Set<string>;
  parameterIndex: number;
  hints?: string[];
}

export interface SpecificationQuery {
  where?: string;
  parameters?: Record<string, unknown>;
  joins?: JoinClause[];
  orderBy?: OrderByClause[];
  select?: string[];
}

export interface JoinClause {
  type: 'inner' | 'left';
  relation: string;
  alias: string;
  condition?: string;
  conditionParameters?: Record<string, unknown>;
}

export interface OrderByClause {
  field: string;
  direction: 'ASC' | 'DESC';
  nulls?: 'NULLS FIRST' | 'NULLS LAST';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface SpecificationMetadata {
  name: string;
  description?: string;
  tags?: string[];
  requiredRelations?: string[];
  indexHints?: string[];
}

/**
 * Abstract base class for all specifications.
 * Implements the Specification pattern with full composite support.
 *
 * @example
 * class ActiveUsersSpec extends Specification<User> {
 *   toQuery(context: QueryContext): SpecificationQuery {
 *     return {
 *       where: `${context.alias}.isActive = :isActive`,
 *       parameters: { isActive: true },
 *     };
 *   }
 * }
 */
export abstract class Specification<T> {
  /** Metadata for tooling, validation, and optimization */
  readonly metadata: SpecificationMetadata;

  constructor(metadata?: Partial<SpecificationMetadata>) {
    this.metadata = {
      name: this.constructor.name,
      ...metadata,
    };
  }

  /**
   * Converts this specification into a TypeORM-compatible query fragment.
   * Must be implemented by all concrete specifications.
   */
  abstract toQuery(context: QueryContext): SpecificationQuery;

  /**
   * Applies this specification to a TypeORM QueryBuilder.
   * Handles joins, where conditions, and parameters automatically.
   */
  applyTo<E>(
    qb: SelectQueryBuilder<E>,
    context?: Partial<QueryContext>,
  ): SelectQueryBuilder<E> {
    const ctx: QueryContext = {
      alias: qb.alias,
      addedJoins: new Set(),
      parameterIndex: 0,
      ...context,
    };

    const query = this.toQuery(ctx);

    if (query.joins) {
      for (const join of query.joins) {
        const joinKey = `${join.alias}`;
        if (!ctx.addedJoins.has(joinKey)) {
          ctx.addedJoins.add(joinKey);
          const joinMethod = join.type === 'inner' ? 'innerJoin' : 'leftJoin';
          qb[joinMethod](
            join.relation,
            join.alias,
            join.condition,
            join.conditionParameters,
          );
        }
      }
    }

    if (query.where) {
      qb.andWhere(query.where, query.parameters);
    }

    if (query.orderBy) {
      for (const order of query.orderBy) {
        qb.addOrderBy(order.field, order.direction, order.nulls);
      }
    }

    if (query.select?.length) {
      qb.addSelect(query.select);
    }

    return qb;
  }

  // ─── Composition Operators ────────────────────────────────────────────────

  /** Creates an AND composite of this and another specification */
  and(other: Specification<T>): AndSpecification<T> {
    return new AndSpecification<T>(this, other);
  }

  /** Creates an OR composite of this and another specification */
  or(other: Specification<T>): OrSpecification<T> {
    return new OrSpecification<T>(this, other);
  }

  /** Creates a NOT composite wrapping this specification */
  not(): NotSpecification<T> {
    return new NotSpecification<T>(this);
  }

  /** Adds pagination to this specification */
  paginate(page: number, limit: number): PaginatedSpecification<T> {
    return new PaginatedSpecification<T>(this, { page, limit });
  }

  /** Checks whether an entity satisfies this specification in-memory */
  isSatisfiedBy(_candidate: Partial<T>): boolean {
    // Default implementation — override in concrete classes for in-memory filtering
    throw new Error(
      `isSatisfiedBy not implemented for ${this.constructor.name}. ` +
        `Override this method to support in-memory evaluation.`,
    );
  }

  /** Returns a human-readable description of this specification */
  describe(): string {
    return this.metadata.description ?? this.metadata.name;
  }
}
