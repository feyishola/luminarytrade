import { Injectable } from "@nestjs/common";
import { BaseAIProvider } from "./base-ai-provider";
import { NormalizedScoringResult } from "../dto/ai-scoring.dto";
import axios, { AxiosInstance } from "axios";
import { AIProvider } from "../entities/ai-result-entity";
import { Plugin } from "../../plugins/decorators/plugin.decorator";

@Injectable()
@Plugin({
  name: AIProvider.GROK,
  version: "1.0.0",
  description: "xAI Grok Scoring Provider",
})
export class GrokProvider extends BaseAIProvider {
  private client: AxiosInstance;

  constructor(
    apiKey: string,
    options?: { maxRetries?: number; timeout?: number },
  ) {
    super(apiKey, AIProvider.GROK, options);
    this.client = axios.create({
      baseURL: "https://api.x.ai/v1",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: this.timeout,
    });
  }

  async score(userData: Record<string, any>): Promise<NormalizedScoringResult> {
    return this.withRetry(async () => {
      const response = await this.client.post("/chat/completions", {
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content:
              "You are a financial risk assessment expert. Return JSON with creditScore, riskScore, and analysis.",
          },
          {
            role: "user",
            content: JSON.stringify(userData),
          },
        ],
        temperature: 0.2,
      });

      const result = JSON.parse(response.data.choices[0].message.content);

      return {
        provider: AIProvider.GROK,
        creditScore: this.normalizeScore(
          result.creditScore || result.score,
          300,
          850,
        ),
        riskScore:
          result.riskScore ||
          100 - this.normalizeScore(result.creditScore, 300, 850),
        riskLevel: this.calculateRiskLevel(result.riskScore || 50),
        confidence: 0.8,
        reasoning: result.analysis || result.reasoning,
        rawResponse: response.data,
      };
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get("/models");
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
