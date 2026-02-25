import { Controller, Get, Query, Param } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { SearchAgentsDto } from './dto/search-agent.dto';
import { Agent } from './entities/agent.entity';
import { PaginatedResponse } from './indexer.service';
import { IAgentSearch } from '../common/interfaces/controller-interfaces/agent-controller.interfaces';

@Controller('agents')
export class AgentSearchController implements IAgentSearch {
  constructor(private readonly indexerService: IndexerService) {}

  @Get('search')
  async search(@Query() searchDto: SearchAgentsDto): Promise<PaginatedResponse<Agent>> {
    return await this.indexerService.search(searchDto);
  }

  @Get('top-performers')
  async getTopPerformers(@Query('limit') limit?: number): Promise<Agent[]> {
    return await this.indexerService.getTopPerformers(limit);
  }
}