import { SelectQueryBuilder } from 'typeorm';
import { ISpecification } from './specification.interface';
import { Agent } from '../entities/agent.entity';
import { SearchAgentsDto, SortOrder } from '../dto/search-agent.dto';

export class AgentQuerySpecification implements ISpecification<Agent> {
  constructor(private readonly searchDto: SearchAgentsDto) {}

  apply(query: SelectQueryBuilder<Agent>): SelectQueryBuilder<Agent> {
    const {
      page,
      limit,
      sort_by,
      order,
      name,
      capabilities,
      evolution_level_min,
      evolution_level_max,
    } = this.searchDto;

    // Filters
    if (name) {
      query.andWhere('agent.name ILIKE :name', {
        name: `%${name}%`,
      });
    }

    if (capabilities && capabilities.length > 0) {
      query.andWhere('agent.capabilities @> :capabilities', {
        capabilities: JSON.stringify(capabilities),
      });
    }

    if (evolution_level_min !== undefined) {
      query.andWhere('agent.evolution_level >= :min', {
        min: evolution_level_min,
      });
    }

    if (evolution_level_max !== undefined) {
      query.andWhere('agent.evolution_level <= :max', {
        max: evolution_level_max,
      });
    }

    // Sorting
    const orderDirection = order === SortOrder.ASC ? 'ASC' : 'DESC';
    query.orderBy(`agent.${sort_by}`, orderDirection);

    // Pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    return query;
  }
}