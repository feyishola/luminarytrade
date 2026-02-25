import { Module, Global } from "@nestjs/common";
import { PluginRegistry } from "./registry/plugin.registry";

@Global()
@Module({
  providers: [PluginRegistry],
  exports: [PluginRegistry],
})
export class PluginsModule {}
