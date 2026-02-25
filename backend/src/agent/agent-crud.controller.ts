import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { Agent } from './entities/agent.entity';
import { IAgentCRUD } from '../common/interfaces/controller-interfaces/agent-controller.interfaces';

@Controller('agents')
export class AgentCRUDController implements IAgentCRUD {
  constructor(private readonly indexerService: IndexerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAgentDto: CreateAgentDto): Promise<Agent> {
    return await this.indexerService.create(createAgentDto);
  }

  async findOne(id: string): Promise<Agent> {
    return await this.indexerService.findOne(id);
  }
}