import { Test, TestingModule } from "@nestjs/testing";
import { AIProviderFactoryImpl } from "./ai-provider.factory.impl";
import { PluginRegistry } from "../../plugins/registry/plugin.registry";
import { AIProvider } from "../entities/ai-result-entity";
import { IAIProvider } from "../interface/ai-provider.interface";
import {
  IPlugin,
  PluginMetadata,
} from "../../plugins/interfaces/plugin.interface";

class MockAIProvider implements IAIProvider, IPlugin {
  constructor(private readonly name: AIProvider) {}

  async score(userData: Record<string, any>): Promise<any> {
    return {};
  }
  async isHealthy(): Promise<boolean> {
    return true;
  }
  getName(): string {
    return this.name;
  }
  isConfigured(): boolean {
    return true;
  }

  getMetadata(): PluginMetadata {
    return { name: this.name, version: "1.0.0" };
  }
}

describe("AIProviderFactoryImpl", () => {
  let factory: AIProviderFactoryImpl;
  let registry: PluginRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIProviderFactoryImpl,
        {
          provide: PluginRegistry,
          useValue: {
            getAllPlugins: jest.fn(),
          },
        },
      ],
    }).compile();

    factory = module.get<AIProviderFactoryImpl>(AIProviderFactoryImpl);
    registry = module.get<PluginRegistry>(PluginRegistry);
  });

  it("should be defined", () => {
    expect(factory).toBeDefined();
  });

  it("should find a registered AI provider", () => {
    const openai = new MockAIProvider(AIProvider.OPENAI);
    (registry.getAllPlugins as jest.Mock).mockReturnValue([openai]);

    const provider = factory.getProvider(AIProvider.OPENAI);
    expect(provider).toBeDefined();
    expect(provider?.getName()).toBe(AIProvider.OPENAI);
  });

  it("should return undefined for non-existent provider", () => {
    (registry.getAllPlugins as jest.Mock).mockReturnValue([]);

    const provider = factory.getProvider(AIProvider.OPENAI);
    expect(provider).toBeUndefined();
  });

  it("should list all available providers", () => {
    const openai = new MockAIProvider(AIProvider.OPENAI);
    const grok = new MockAIProvider(AIProvider.GROK);
    (registry.getAllPlugins as jest.Mock).mockReturnValue([openai, grok]);

    const available = factory.getAvailableProviders();
    expect(available).toContain(AIProvider.OPENAI);
    expect(available).toContain(AIProvider.GROK);
    expect(available.length).toBe(2);
  });
});
