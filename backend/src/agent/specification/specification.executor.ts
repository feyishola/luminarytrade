import { Repository, SelectQueryBuilder } from 'typeorm';
import { ISpecification } from './specification.interface';

export class SpecificationExecutor<T> {
  constructor(private readonly repository: Repository<T>) {}

  execute(
    spec: ISpecification<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const queryBuilder = this.repository.createQueryBuilder(alias);
    return spec.apply(queryBuilder);
  }
}