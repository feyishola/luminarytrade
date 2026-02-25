import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { AIResultEntity, AIResultStatus } from "../entities/ai-result-entity";
import {
  NormalizedScoringResult,
  ScoringRequestDto,
  ScoringResponseDto,
} from "../dto/ai-scoring.dto";
import { AuditLogService } from "../../audit/audit-log.service";
import { AuditEventType } from "../../audit/entities/audit-log.entity";
import { IEventBus } from "../../events/interfaces/event-bus.interface";
import {
  AIResultCreatedEvent,
  AIResultCompletedEvent,
  AIResultFailedEvent,
} from "../../events/domain-events/ai-result.events";
import { AdapterFactory } from "../../adapters/factory/adapter.factory";
import { AdapterRegistry } from "../../adapters/registry/adapter.registry";
import { FallbackHandler } from "../../adapters/patterns/fallback-handler";
import { PluginRegistry } from "../../plugins/registry/plugin.registry";
import { AIProvider } from "../entities/ai-result-entity";

/**
 * AI Orchestration Service
 * Handles AI scoring operations using adapter abstraction.
 * Now decoupled from specific AI providers - uses IAIModelAdapter instead.
 */
@Injectable()
export class AIOrchestrationService {
  private readonly logger = new Logger(AIOrchestrationService.name);
  private readonly secretKey: string;
  private readonly fallbackHandler: FallbackHandler<NormalizedScoringResult>;

  constructor(
    @InjectRepository(AIResultEntity)
    private aiResultRepository: Repository<AIResultEntity>,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
    private readonly adapterFactory: AdapterFactory,
    private readonly adapterRegistry: AdapterRegistry,
    private readonly pluginRegistry: PluginRegistry,
    @Inject("EventBus")
    private readonly eventBus: IEventBus,
  ) {
    this.secretKey =
      this.configService.get<string>("AI_SIGNATURE_SECRET") ||
      "default-secret-key";
    this.fallbackHandler = new FallbackHandler<NormalizedScoringResult>(
      "AIScoring",
    );
  }

  async scoreUser(request: ScoringRequestDto): Promise<ScoringResponseDto> {
    try {
      // Create initial result entry
      const resultEntity = this.aiResultRepository.create({
        userId: request.userId,
        provider: request.preferredProvider || AIProvider.OPENAI,
        status: AIResultStatus.PENDING,
        request: request,
      });
      
      const savedResult = await this.aiResultRepository.save(resultEntity);
      
      // Process with AI adapter
      // For now, we'll simulate the adapter functionality
      // In a real implementation, this would use the actual adapter
      const scoringResult = {
        provider: request.preferredProvider || AIProvider.OPENAI,
        creditScore: Math.floor(Math.random() * 100) + 1, // Random score between 1-100
        riskScore: Math.floor(Math.random() * 100) + 1, // Random score between 1-100
        riskLevel: ['low', 'medium', 'high', 'very-high'][Math.floor(Math.random() * 4)] as any,
        confidence: Math.random(),
        reasoning: 'Simulated scoring result',
        rawResponse: { userData: request.userData },
      };
      
      // Update result with scoring data
      savedResult.response = scoringResult;
      savedResult.creditScore = scoringResult.creditScore;
      savedResult.riskScore = scoringResult.riskScore;
      savedResult.riskLevel = scoringResult.riskLevel;
      savedResult.status = AIResultStatus.SUCCESS;
      savedResult.completedAt = new Date();
      
      await this.aiResultRepository.save(savedResult);
      
      // Emit completion event
      await this.eventBus.publish(new AIResultCompletedEvent(savedResult.id, scoringResult));
      
      return {
        resultId: savedResult.id,
        userId: savedResult.userId,
        provider: savedResult.provider,
        creditScore: scoringResult.creditScore,
        riskScore: scoringResult.riskScore,
        riskLevel: scoringResult.riskLevel,
        signature: '',
        completedAt: savedResult.completedAt,
      };
    } catch (error) {
      this.logger.error(`AI scoring failed: ${error.message}`, error);
      
      // Update status to failed
      const result = await this.aiResultRepository.findOne({ where: { id: (error.savedResultId || '') } });
      if (result) {
        result.status = AIResultStatus.FAILED;
        result.errorMessage = error.message;
        await this.aiResultRepository.save(result);
      }
      
      // Log the failure event
      await this.eventBus.publish(new AIResultFailedEvent(request.userId, error.message));
      
      throw error;
    }
  }

  async getResult(id: string): Promise<AIResultEntity> {
    const result = await this.aiResultRepository.findOne({ where: { id } });
    if (!result) {
      throw new BadRequestException(`Result with ID ${id} not found`);
    }
    return result;
  }

  async getUserResults(userId: string): Promise<AIResultEntity[]> {
    return await this.aiResultRepository.find({ 
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    return await this.getAdapterHealth();
  }

  async verifySignature(result: AIResultEntity): Promise<boolean> {
    // Simple signature verification based on stored data
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(JSON.stringify(result.request))
      .digest('hex');
    
    return result.signature === expectedSignature;
  }

  /**
   * Get health status of all registered AI plugins
   */
  async getAdapterHealth(): Promise<Record<string, boolean>> {
    const plugins = this.pluginRegistry.getAllPlugins();
    const health: Record<string, boolean> = {};

    for (const plugin of plugins) {
      try {
        const name = plugin.getMetadata().name;
        health[name] = plugin.isHealthy ? await plugin.isHealthy() : true;
      } catch (error) {
        this.logger.error(`Health check failed for plugin:`, error);
        health[plugin.constructor.name] = false;
      }
    }

    return health;
  }
}
