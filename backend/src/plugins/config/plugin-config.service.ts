import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PluginEventBus } from "../communication/event-bus.plugin";

@Injectable()
export class PluginConfigService {
  private readonly logger = new Logger(PluginConfigService.name);
  private pluginConfigs = new Map<string, any>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventBus: PluginEventBus,
  ) {}

  /**
   * Get configuration for a specific plugin
   * @param pluginName Name of the plugin
   */
  getPluginConfig<T>(pluginName: string): T {
    // If we have a cached config, return it
    if (this.pluginConfigs.has(pluginName)) {
      return this.pluginConfigs.get(pluginName) as T;
    }

    // Otherwise, try to load it from env or default config
    const config = this.loadConfig(pluginName);
    this.pluginConfigs.set(pluginName, config);
    return config as T;
  }

  /**
   * Reload configuration for a plugin
   * @param pluginName Name of the plugin
   */
  async reloadConfig(pluginName: string): Promise<void> {
    this.logger.log(`Reloading configuration for plugin: ${pluginName}`);
    const newConfig = this.loadConfig(pluginName);
    this.pluginConfigs.set(pluginName, newConfig);

    // Notify plugin of config change
    this.eventBus.publish(`${pluginName}.config_changed`, newConfig);
  }

  private loadConfig(pluginName: string): any {
    // Basic implementation: look for environment variables with PLUGIN_ prefix
    // e.g. PLUGIN_OPENAI_TIMEOUT
    const prefix = `PLUGIN_${pluginName.toUpperCase()}_`;
    const config: any = {};

    // This is a simplified version. In a real app, you'd iterate over process.env
    // or use a more robust way to gather these.

    // For now, let's just return what's in ConfigService if it exists
    return this.configService.get(pluginName) || {};
  }

  /**
   * Update configuration at runtime
   * @param pluginName Name of the plugin
   * @param config New configuration
   */
  updateConfig(pluginName: string, config: any): void {
    this.pluginConfigs.set(pluginName, config);
    this.eventBus.publish(`${pluginName}.config_changed`, config);
  }
}
