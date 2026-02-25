import { SelectQueryBuilder } from 'typeorm';
import { ISpecification } from './specification.interface';
import { Agent } from '../entities/agent.entity';

export class HighPerformerSpec implements ISpecification<Agent> {
  constructor(private readonly limit: number = 10) {}

  apply(query: SelectQueryBuilder<Agent>): SelectQueryBuilder<Agent> {
    return query
      .orderBy("(agent.performance_metrics->>'success_rate')::float", 'DESC')
      .limit(this.limit);
  }
}