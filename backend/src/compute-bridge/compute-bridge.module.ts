import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { AIResultEntity } from "./entities/ai-result-entity";
import { ComputeBridgeController } from "./compute-bridge.controller";
import { AIOrchestrationService } from "./service/ai-orchestration.service";
import { AuditLogModule } from "../audit/audit-log.module";
import { OpenAIProvider } from "./provider/open-ai.provider";
import { GrokProvider } from "./provider/grok.provider";
import { LlamaProvider } from "./provider/llama.provider";
import { AIProviderFactoryImpl } from "./provider/ai-provider.factory.impl";

@Module({
  imports: [
    TypeOrmModule.forFeature([AIResultEntity]),
    ConfigModule,
    AuditLogModule,
  ],
  controllers: [ComputeBridgeController],
  providers: [
    AIOrchestrationService,
    OpenAIProvider,
    GrokProvider,
    LlamaProvider,
    {
      provide: "AIProviderFactory",
      useClass: AIProviderFactoryImpl,
    },
  ],
  exports: [AIOrchestrationService],
})
export class ComputeBridgeModule {}
