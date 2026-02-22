import { AIProvider } from '../entities/ai-result-entity';
import { IAIProvider } from '../interface/ai-provider.interface';

export interface AIProviderFactory {
  getProvider(type: AIProvider): IAIProvider | undefined;
  getAvailableProviders(): AIProvider[];
}