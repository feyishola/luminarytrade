import { Controller, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { AIOrchestrationService } from './service/ai-orchestration.service';
import { ScoringRequestDto, ScoringResponseDto } from './dto/ai-scoring.dto';
import { AIResultEntity } from './entities/ai-result-entity';
import { IComputeBridgeCRUD } from '../common/interfaces/controller-interfaces/compute-bridge-controller.interfaces';

@Controller('compute-bridge')
export class ComputeBridgeCRUDController implements IComputeBridgeCRUD {
  constructor(private readonly aiOrchestrationService: AIOrchestrationService) {}

  @Post('score')
  @HttpCode(HttpStatus.ACCEPTED)
  async scoreUser(@Body() request: ScoringRequestDto): Promise<ScoringResponseDto> {
    return this.aiOrchestrationService.scoreUser(request);
  }

  @Post('results/:id')
  async getResult(@Param('id') id: string): Promise<AIResultEntity> {
    return this.aiOrchestrationService.getResult(id);
  }

  @Post('users/:userId/results')
  async getUserResults(@Param('userId') userId: string): Promise<AIResultEntity[]> {
    return this.aiOrchestrationService.getUserResults(userId);
  }
}