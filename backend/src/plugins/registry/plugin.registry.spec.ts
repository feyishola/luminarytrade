import { Test, TestingModule } from "@nestjs/testing";
import { PluginRegistry } from "./plugin.registry";
import { IPlugin, PluginMetadata } from "../interfaces/plugin.interface";
import { Plugin } from "../decorators/plugin.decorator";

@Plugin({
  name: "test-plugin",
  version: "1.0.0",
  description: "Test Plugin",
})
class TestPlugin implements IPlugin {
  initialized = false;
  enabled = false;
  disabled = false;
  destroyed = false;

  getMetadata(): PluginMetadata {
    return {
      name: "test-plugin",
      version: "1.0.0",
    };
  }

  async onInit() {
    this.initialized = true;
  }
  async onEnable() {
    this.enabled = true;
  }
  async onDisable() {
    this.disabled = true;
  }
  async onDestroy() {
    this.destroyed = true;
  }
  async isHealthy() {
    return true;
  }
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry;
  let plugin: TestPlugin;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PluginRegistry],
    }).compile();

    registry = module.get<PluginRegistry>(PluginRegistry);
    plugin = new TestPlugin();
  });

  it("should be defined", () => {
    expect(registry).toBeDefined();
  });

  it("should register and retrieve a plugin", async () => {
    await registry.registerPlugin(plugin);
    expect(registry.getPlugin("test-plugin")).toBe(plugin);
    expect(registry.getAllPlugins()).toContain(plugin);
  });

  it("should execute lifecycle hooks during bootstrap", async () => {
    await registry.registerPlugin(plugin);
    await registry.onApplicationBootstrap();

    expect(plugin.initialized).toBe(true);
    expect(plugin.enabled).toBe(true);
  });

  it("should execute lifecycle hooks during shutdown", async () => {
    await registry.registerPlugin(plugin);
    await registry.onApplicationBootstrap();
    await registry.onApplicationShutdown();

    expect(plugin.disabled).toBe(true);
    expect(plugin.destroyed).toBe(true);
  });

  it("should handle multiple plugins in order", async () => {
    const plugin2 = new TestPlugin();
    // Override name via metadata for plugin2 if needed, but here we just register another instance
    // Normally plugins have unique names
    Object.defineProperty(plugin2, "getMetadata", {
      value: () => ({ name: "test-plugin-2", version: "1.0.0" }),
    });

    await registry.registerPlugin(plugin);
    await registry.registerPlugin(plugin2);

    await registry.onApplicationBootstrap();

    expect(registry.getAllPlugins().length).toBe(2);
  });
});
