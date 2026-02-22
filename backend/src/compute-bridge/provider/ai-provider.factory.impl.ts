import { Injectable } from '@nestjs/common';
import { AIProviderFactory } from './ai-provider.factory';
import { AIProvider } from '../entities/ai-result-entity';
import { IAIProvider } from '../interface/ai-provider.interface';
import { OpenAIProvider } from './open-ai.provider';
import { GrokProvider } from './grok.provider';
import { LlamaProvider } from './llama.provider';

@Injectable()
export class AIProviderFactoryImpl implements AIProviderFactory {
  private providerMap = new Map<AIProvider, IAIProvider>();

  constructor(
    private readonly openAIProvider: OpenAIProvider,
    private readonly grokProvider: GrokProvider,
    private readonly llamaProvider: LlamaProvider,
  ) {
    this.registerProviders();
  }

  private registerProviders() {
    if (this.openAIProvider.isConfigured()) {
      this.providerMap.set(AIProvider.OPENAI, this.openAIProvider);
    }

    if (this.grokProvider.isConfigured()) {
      this.providerMap.set(AIProvider.GROK, this.grokProvider);
    }

    if (this.llamaProvider.isConfigured()) {
      this.providerMap.set(AIProvider.LLAMA, this.llamaProvider);
    }
  }

  getProvider(type: AIProvider): IAIProvider | undefined {
    return this.providerMap.get(type);
  }

  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providerMap.keys());
  }
}