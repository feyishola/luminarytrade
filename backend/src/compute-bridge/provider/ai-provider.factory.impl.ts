import { Injectable, Logger } from "@nestjs/common";
import { AIProviderFactory } from "./ai-provider.factory";
import { AIProvider } from "../entities/ai-result-entity";
import { IAIProvider } from "../interface/ai-provider.interface";
import { PluginRegistry } from "../../plugins/registry/plugin.registry";
import { IPlugin } from "../../plugins/interfaces/plugin.interface";

@Injectable()
export class AIProviderFactoryImpl implements AIProviderFactory {
  private readonly logger = new Logger(AIProviderFactoryImpl.name);

  constructor(private readonly pluginRegistry: PluginRegistry) {}

  getProvider(type: AIProvider): IAIProvider | undefined {
    // Try to find a plugin that implements IAIProvider and matches the type
    const plugins = this.pluginRegistry.getAllPlugins();

    for (const plugin of plugins) {
      if (this.isAIProvider(plugin) && plugin.getName() === type) {
        return plugin;
      }
    }

    return undefined;
  }

  getAvailableProviders(): AIProvider[] {
    const plugins = this.pluginRegistry.getAllPlugins();
    return plugins
      .filter(this.isAIProvider)
      .map((p) => p.getName() as AIProvider);
  }

  private isAIProvider(plugin: IPlugin): plugin is IAIProvider & IPlugin {
    // Check if it has the required IAIProvider methods
    const provider = plugin as any;
    return (
      typeof provider.score === "function" &&
      typeof provider.isHealthy === "function" &&
      typeof provider.getName === "function"
    );
  }
}
