
import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ScoringRequestDto, ScoringResponseDto } from './dto/ai-scoring.dto';
import { AIOrchestrationService } from './service/ai-orchestration.service';
import { AIResultEntity } from './entities/ai-result-entity';

@Controller('compute-bridge')
export class ComputeBridgeController {
  constructor(private readonly aiOrchestrationService: AIOrchestrationService) {}

  @Post('score')
  @HttpCode(HttpStatus.ACCEPTED)
  async scoreUser(@Body() request: ScoringRequestDto): Promise<ScoringResponseDto> {
    return this.aiOrchestrationService.scoreUser(request);
  }

  @Get('results/:id')
  async getResult(@Param('id') id: string): Promise<AIResultEntity> {
    return this.aiOrchestrationService.getResult(id);
  }

  @Get('users/:userId/results')
  async getUserResults(@Param('userId') userId: string): Promise<AIResultEntity[]> {
    return this.aiOrchestrationService.getUserResults(userId);
  }

  @Get('health')
  async healthCheck(): Promise<Record<string, boolean>> {
    return this.aiOrchestrationService.healthCheck();
  }

  @Post('verify/:id')
  async verifyResult(@Param('id') id: string): Promise<{ valid: boolean }> {
    const result = await this.aiOrchestrationService.getResult(id);
    const valid = await this.aiOrchestrationService.verifySignature(result);
    return { valid };
  }
}