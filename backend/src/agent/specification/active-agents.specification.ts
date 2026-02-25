import { SelectQueryBuilder } from 'typeorm';
import { ISpecification } from './specification.interface';
import { Agent } from '../entities/agent.entity';

export class ActiveAgentsSpec implements ISpecification<Agent> {
  apply(query: SelectQueryBuilder<Agent>): SelectQueryBuilder<Agent> {
    return query.andWhere('agent.is_active = :active', {
      active: true,
    });
  }
}