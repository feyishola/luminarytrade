export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  author?: string;
  license?: string;
}

export interface IPlugin {
  getMetadata(): PluginMetadata;

  /**
   * Called when the plugin is first discovered and loaded.
   * Internal initialization should happen here.
   */
  onInit?(): Promise<void>;

  /**
   * Called when the plugin is enabled and becomes available for use.
   */
  onEnable?(): Promise<void>;

  /**
   * Called when the plugin is disabled.
   */
  onDisable?(): Promise<void>;

  /**
   * Called when the plugin is about to be unloaded or the application is shutting down.
   */
  onDestroy?(): Promise<void>;

  /**
   * Basic health check for the plugin.
   */
  isHealthy?(): Promise<boolean>;
}
