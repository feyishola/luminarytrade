import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { AIOrchestrationService } from './service/ai-orchestration.service';
import { AIResultEntity } from './entities/ai-result-entity';
import { IComputeBridgeQuery } from '../common/interfaces/controller-interfaces/compute-bridge-controller.interfaces';

@Controller('compute-bridge')
export class ComputeBridgeQueryController implements IComputeBridgeQuery {
  constructor(private readonly aiOrchestrationService: AIOrchestrationService) {}

  @Get('health')
  async healthCheck(): Promise<Record<string, boolean>> {
    return this.aiOrchestrationService.healthCheck();
  }

  @Get('verify/:id')
  async verifyResult(@Param('id') id: string): Promise<{ valid: boolean }> {
    const result = await this.aiOrchestrationService.getResult(id);
    const valid = await this.aiOrchestrationService.verifySignature(result);
    return { valid };
  }
}