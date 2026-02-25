import { CreateAgentDto } from '../../../agent/dto/create-agent.dto';
import { SearchAgentsDto } from '../../../agent/dto/search-agent.dto';
import { Agent } from '../../../agent/entities/agent.entity';
import { PaginatedResponse } from '../../../agent/indexer.service';

// CRUD operations for Agent
export interface IAgentCRUD {
  create(createAgentDto: CreateAgentDto): Promise<Agent>;
  findOne(id: string): Promise<Agent>;
}

// Search operations for Agent
export interface IAgentSearch {
  search(searchDto: SearchAgentsDto): Promise<PaginatedResponse<Agent>>;
  getTopPerformers(limit?: number): Promise<Agent[]>;
}

// Analytics operations for Agent
export interface IAgentAnalytics {
  getStatistics(): Promise<any>; // Define specific stats type as needed
  getMetrics(): Promise<any>; // Define specific metrics type as needed
}