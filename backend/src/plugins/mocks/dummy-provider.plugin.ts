import { Injectable, Logger } from "@nestjs/common";
import { BaseAIProvider } from "../compute-bridge/provider/base-ai-provider";
import { NormalizedScoringResult } from "../compute-bridge/dto/ai-scoring.dto";
import { AIProvider } from "../compute-bridge/entities/ai-result-entity";
import { Plugin } from "./decorators/plugin.decorator";

@Injectable()
@Plugin({
  name: "dummy-provider",
  version: "1.0.0",
  description: "Dummy AI Provider for Testing",
})
export class DummyAIProvider extends BaseAIProvider {
  constructor() {
    super("dummy-key", "openai" as any); // Reusing openai type for simplicity in dummy
    this.providerName = "dummy" as any;
  }

  async score(userData: Record<string, any>): Promise<NormalizedScoringResult> {
    this.logger.log("Scoring with dummy provider");
    return {
      provider: "dummy",
      creditScore: 700,
      riskScore: 20,
      riskLevel: "low",
      confidence: 1.0,
      rawResponse: { dummy: true },
    };
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async onInit(): Promise<void> {
    await super.onInit();
    this.logger.log("Dummy provider plugin initialized");
  }

  async onEnable(): Promise<void> {
    await super.onEnable();
    this.logger.log("Dummy provider plugin enabled");
  }
}
