import { SelectQueryBuilder } from 'typeorm';

export interface ISpecification<T> {
  apply(query: SelectQueryBuilder<T>): SelectQueryBuilder<T>;
}