import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class PluginEventBus {
  private readonly logger = new Logger(PluginEventBus.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  publish(event: string, payload: any): void {
    this.logger.debug(`Publishing plugin event: ${event}`);
    this.eventEmitter.emit(`plugin.${event}`, payload);
  }

  subscribe(event: string, handler: (payload: any) => void): void {
    this.logger.debug(`Subscribing to plugin event: ${event}`);
    this.eventEmitter.on(`plugin.${event}`, handler);
  }
}
