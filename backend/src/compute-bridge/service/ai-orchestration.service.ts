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

  // ... (methods scoreUser, getResult, etc. remain unchanged)

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
