import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseAIProvider } from "./base-ai-provider";
import { NormalizedScoringResult } from "../dto/ai-scoring.dto";
import axios, { AxiosInstance } from "axios";
import { AIProvider } from "../entities/ai-result-entity";
import { Plugin } from "../../plugins/decorators/plugin.decorator";

@Injectable()
@Plugin({
  name: AIProvider.OPENAI,
  version: "1.0.0",
  description: "OpenAI GPT-4 Scoring Provider",
})
export class OpenAIProvider extends BaseAIProvider {
  private client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const apiKey = configService.get<string>("OPENAI_API_KEY");
    super(apiKey || "", AIProvider.OPENAI);

    this.client = axios.create({
      baseURL: "https://api.openai.com/v1",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: this.timeout,
    });
  }

  async score(userData: Record<string, any>): Promise<NormalizedScoringResult> {
    if (!this.apiKey) {
      throw new Error("OpenAI not configured");
    }

    return this.withRetry(async () => {
      const prompt = this.buildScoringPrompt(userData);

      const response = await this.client.post("/chat/completions", {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a credit risk AI." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.data.choices[0].message.content);

      return {
        provider: AIProvider.OPENAI,
        creditScore: this.normalizeScore(result.creditScore, 300, 850),
        riskScore: result.riskScore,
        riskLevel: this.calculateRiskLevel(result.riskScore),
        confidence: result.confidence || 0.85,
        reasoning: result.reasoning,
        rawResponse: response.data,
      };
    });
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      await this.client.get("/models");
      return true;
    } catch {
      return false;
    }
  }

  private buildScoringPrompt(userData: Record<string, any>): string {
    return `Analyze financial profile:\n${JSON.stringify(userData, null, 2)}`;
  }
}
