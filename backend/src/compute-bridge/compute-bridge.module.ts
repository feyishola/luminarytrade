import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AIResultEntity } from './entities/ai-result-entity';
import { ComputeBridgeController } from './compute-bridge.controller';
import { AIOrchestrationService } from './service/ai-orchestration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AIResultEntity]),
    ConfigModule,
  ],
  controllers: [ComputeBridgeController],
  providers: [AIOrchestrationService],
  exports: [AIOrchestrationService],
})
export class ComputeBridgeModule {}
