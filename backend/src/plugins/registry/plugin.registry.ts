import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { IPlugin, PluginMetadata } from "../interfaces/plugin.interface";
import { getPluginMetadata } from "../decorators/plugin.decorator";

@Injectable()
export class PluginRegistry
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PluginRegistry.name);
  private readonly plugins = new Map<string, IPlugin>();
  private readonly loadingOrder: string[] = [];

  /**
   * Register a plugin instance
   * @param plugin Plugin instance
   */
  async registerPlugin(plugin: IPlugin): Promise<void> {
    const metadata = plugin.getMetadata() || getPluginMetadata(plugin);

    if (!metadata) {
      throw new Error(`Plugin ${plugin.constructor.name} missing metadata`);
    }

    if (this.plugins.has(metadata.name)) {
      this.logger.warn(
        `Plugin ${metadata.name} already registered. Overwriting.`,
      );
    }

    this.plugins.set(metadata.name, plugin);
    this.logger.log(
      `Registered plugin: ${metadata.name} (v${metadata.version})`,
    );
  }

  /**
   * Initialize all registered plugins
   */
  async initializePlugins(): Promise<void> {
    this.logger.log("Initializing plugins...");

    // Simple dependency resolution - for now just alphabetical or registration order
    // In a full implementation, we would build a dependency graph
    const pluginNames = Array.from(this.plugins.keys());

    for (const name of pluginNames) {
      const plugin = this.plugins.get(name);
      if (plugin && plugin.onInit) {
        try {
          await plugin.onInit();
          this.logger.debug(`Plugin ${name} initialized`);
        } catch (error) {
          this.logger.error(`Failed to initialize plugin ${name}:`, error);
        }
      }
    }
  }

  /**
   * Enable all initialized plugins
   */
  async enablePlugins(): Promise<void> {
    this.logger.log("Enabling plugins...");

    for (const [name, plugin] of this.plugins.entries()) {
      if (plugin.onEnable) {
        try {
          await plugin.onEnable();
          this.loadingOrder.push(name);
          this.logger.log(`Plugin ${name} enabled`);
        } catch (error) {
          this.logger.error(`Failed to enable plugin ${name}:`, error);
        }
      } else {
        this.loadingOrder.push(name);
      }
    }
  }

  /**
   * Disable a plugin
   * @param name Plugin name
   */
  async disablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin && plugin.onDisable) {
      try {
        await plugin.onDisable();
        this.logger.log(`Plugin ${name} disabled`);
      } catch (error) {
        this.logger.error(`Failed to disable plugin ${name}:`, error);
      }
    }
  }

  /**
   * Get a plugin by name
   * @param name Plugin name
   */
  getPlugin<T extends IPlugin>(name: string): T | undefined {
    return this.plugins.get(name) as T;
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * NestJS lifecycle hook
   */
  async onApplicationBootstrap() {
    await this.initializePlugins();
    await this.enablePlugins();
  }

  /**
   * NestJS lifecycle hook
   */
  async onApplicationShutdown() {
    this.logger.log("Shutting down plugins...");

    // Shut down in reverse order of enabling
    const reverseOrder = [...this.loadingOrder].reverse();

    for (const name of reverseOrder) {
      const plugin = this.plugins.get(name);
      if (plugin) {
        if (plugin.onDisable) {
          await plugin
            .onDisable()
            .catch((err) => this.logger.error(`Error disabling ${name}:`, err));
        }
        if (plugin.onDestroy) {
          await plugin
            .onDestroy()
            .catch((err) =>
              this.logger.error(`Error destroying ${name}:`, err),
            );
        }
      }
    }
  }
}
