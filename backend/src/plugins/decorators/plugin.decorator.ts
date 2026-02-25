import "reflect-metadata";
import { PluginMetadata } from "../interfaces/plugin.interface";

export const PLUGIN_METADATA_KEY = "plugin:metadata";

/**
 * Decorator to define plugin metadata.
 * @param metadata Plugin metadata
 */
export function Plugin(metadata: PluginMetadata): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(PLUGIN_METADATA_KEY, metadata, target);
  };
}

/**
 * Helper to retrieve plugin metadata from a class.
 * @param target Plugin class
 */
export function getPluginMetadata(target: any): PluginMetadata | undefined {
  return Reflect.getMetadata(PLUGIN_METADATA_KEY, target.constructor || target);
}
