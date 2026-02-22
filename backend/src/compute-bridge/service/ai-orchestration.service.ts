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
import { IAIProvider } from "../interface/ai-provider.interface";
import {
  AIProvider,
  AIResultEntity,
  AIResultStatus,
} from "../entities/ai-result-entity";
import {
  NormalizedScoringResult,
  ScoringRequestDto,
  ScoringResponseDto,
} from "../dto/ai-scoring.dto";
import { LlamaProvider } from "../provider/llama.provider";
import { OpenAIProvider } from "../provider/open-ai.provider";
import { GrokProvider } from "../provider/grok.provider";
import { AuditLogService } from "../../audit/audit-log.service";
import { AuditEventType } from "../../audit/entities/audit-log.entity";
import { AIProviderFactory } from "../provider/ai-provider.factory";

@Injectable()
export class AIOrchestrationService {
  private readonly logger = new Logger(AIOrchestrationService.name);
  private providers: Map<AIProvider, IAIProvider>;
  private readonly secretKey: string;

  constructor(
    @InjectRepository(AIResultEntity)
    private aiResultRepository: Repository<AIResultEntity>,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
    @Inject("AIProviderFactory")
    private readonly providerFactory: AIProviderFactory,
  ) {
    this.secretKey =
      this.configService.get<string>("AI_SIGNATURE_SECRET") ||
      "default-secret-key";
  }

  private initializeProviders(): void {
    this.providers = new Map();

    const openaiKey = this.configService.get<string>("OPENAI_API_KEY");
    const grokKey = this.configService.get<string>("GROK_API_KEY");
    const llamaKey = this.configService.get<string>("LLAMA_API_KEY");

    if (openaiKey) {
      this.providers.set(
        AIProvider.OPENAI,
        new OpenAIProvider(this.configService),
      );
      this.logger.log("OpenAI provider initialized");
    }

    if (grokKey) {
      this.providers.set(AIProvider.GROK, new GrokProvider(grokKey));
      this.logger.log("Grok provider initialized");
    }

    if (llamaKey) {
      this.providers.set(AIProvider.LLAMA, new LlamaProvider(llamaKey));
      this.logger.log("Llama provider initialized");
    }

    if (this.providers.size === 0) {
      this.logger.warn("No AI providers configured");
    }
  }

  async scoreUser(request: ScoringRequestDto): Promise<ScoringResponseDto> {
    // Create initial record
    const aiResult = this.aiResultRepository.create({
      userId: request.userId,
      provider: request.preferredProvider || this.selectProvider(),
      status: AIResultStatus.PENDING,
      request: request.userData,
      retryCount: 0,
    });

    await this.aiResultRepository.save(aiResult);

    // Log audit event for scoring started
    await this.auditLogService.logEvent(
      request.userId,
      AuditEventType.AI_SCORING_STARTED,
      {
        resultId: aiResult.id,
        provider: aiResult.provider,
        userData: request.userData,
      },
      `AI scoring initiated for user ${request.userId}`,
      aiResult.id,
      "AIResult",
    );

    // Execute scoring asynchronously
    this.executeScoringAsync(
      aiResult.id,
      request.userId,
      request.userData,
    ).catch((error) => {
      this.logger.error(`Async scoring failed for ${aiResult.id}:`, error);
    });

    // Return immediately with pending status
    return {
      resultId: aiResult.id,
      userId: aiResult.userId,
      provider: aiResult.provider,
      creditScore: null,
      riskScore: null,
      riskLevel: null,
      signature: null,
      completedAt: null,
    };
  }

  async getResult(resultId: string): Promise<AIResultEntity> {
    return this.aiResultRepository.findOne({ where: { id: resultId } });
  }

  async getUserResults(
    userId: string,
    limit: number = 10,
  ): Promise<AIResultEntity[]> {
    return this.aiResultRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  private async executeScoringAsync(
    resultId: string,
    wallet: string,
    userData: Record<string, any>,
  ): Promise<void> {
    const aiResult = await this.aiResultRepository.findOne({
      where: { id: resultId },
    });
    if (!aiResult) return;

    try {
      aiResult.status = AIResultStatus.RETRYING;
      await this.aiResultRepository.save(aiResult);

      const scoringResult = await this.scoreWithFallback(
        aiResult.provider,
        userData,
        aiResult,
      );

      // Sign the result
      const signature = this.signResult(scoringResult);

      // Update with success
      aiResult.status = AIResultStatus.SUCCESS;
      aiResult.response = scoringResult.rawResponse;
      aiResult.creditScore = scoringResult.creditScore;
      aiResult.riskScore = scoringResult.riskScore;
      aiResult.riskLevel = scoringResult.riskLevel;
      aiResult.signature = signature;
      aiResult.completedAt = new Date();

      await this.aiResultRepository.save(aiResult);

      // Log audit event for scoring completed
      await this.auditLogService.logEvent(
        wallet,
        AuditEventType.AI_SCORING_COMPLETED,
        {
          resultId: aiResult.id,
          provider: scoringResult.provider,
          creditScore: aiResult.creditScore,
          riskScore: aiResult.riskScore,
          riskLevel: aiResult.riskLevel,
        },
        `AI scoring completed for user ${wallet}`,
        aiResult.id,
        "AIResult",
      );

      this.logger.log(
        `Scoring completed for ${resultId} using ${scoringResult.provider}`,
      );
    } catch (error) {
      aiResult.status = AIResultStatus.FAILED;
      aiResult.errorMessage = error.message;
      await this.aiResultRepository.save(aiResult);

      // Log audit event for scoring failed
      await this.auditLogService.logEvent(
        wallet,
        AuditEventType.AI_SCORING_FAILED,
        {
          resultId: aiResult.id,
          errorMessage: error.message,
          provider: aiResult.provider,
        },
        `AI scoring failed for user ${wallet}: ${error.message}`,
        aiResult.id,
        "AIResult",
      );

      this.logger.error(`Scoring failed for ${resultId}:`, error);
    }
  }

  private async scoreWithFallback(
    primaryProvider: AIProvider,
    userData: Record<string, any>,
    aiResult: AIResultEntity,
  ): Promise<NormalizedScoringResult> {
    const providerOrder = this.getProviderFallbackOrder(primaryProvider);

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        aiResult.retryCount++;
        await this.aiResultRepository.save(aiResult);

        const result = await provider.score(userData);
        this.logger.log(`Successfully scored with ${providerName}`);
        return result;
      } catch (error) {
        this.logger.warn(`Provider ${providerName} failed:`, error.message);

        if (aiResult.retryCount >= 3 * this.providers.size) {
          throw new Error("All providers exhausted after retries");
        }

        continue;
      }
    }

    throw new Error("All AI providers failed");
  }

  private getProviderFallbackOrder(primary: AIProvider): AIProvider[] {
    const all = Array.from(this.providers.keys());
    const order = [primary];

    all.forEach((p) => {
      if (p !== primary) order.push(p);
    });

    return order;
  }

  private selectProvider(): AIProvider {
    const available = Array.from(this.providers.keys());
    if (available.length === 0) {
      throw new BadRequestException("No AI providers available");
    }
    // Simple round-robin or random selection
    return available[Math.floor(Math.random() * available.length)];
  }

  private signResult(result: NormalizedScoringResult): string {
    const data = JSON.stringify({
      provider: result.provider,
      creditScore: result.creditScore,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      timestamp: Date.now(),
    });

    return crypto
      .createHmac("sha256", this.secretKey)
      .update(data)
      .digest("hex");
  }

  async verifySignature(result: AIResultEntity): Promise<boolean> {
    const data = JSON.stringify({
      provider: result.provider,
      creditScore: result.creditScore,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      timestamp: result.completedAt?.getTime(),
    });

    const expectedSignature = crypto
      .createHmac("sha256", this.secretKey)
      .update(data)
      .digest("hex");

    return expectedSignature === result.signature;
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, provider] of this.providers.entries()) {
      health[name] = await provider.isHealthy();
    }

    return health;
  }
}
