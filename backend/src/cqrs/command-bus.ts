import { Injectable } from '@nestjs/common';

@Injectable()
export class CommandBus {
  private handlers = new Map<string, any>();

  register(type: string, handler: any) {
    this.handlers.set(type, handler);
  }

  async execute(command: any) {
    const handler = this.handlers.get(command.type);
    if (!handler) throw new Error(`No handler for ${command.type}`);

    if (handler.validate) await handler.validate(command);

    return handler.execute(command);
  }
}