import { Injectable } from '@nestjs/common';

@Injectable()
export class QueryBus {
  private handlers = new Map<string, any>();

  register(type: string, handler: any) {
    this.handlers.set(type, handler);
  }

  async execute(query: any) {
    const handler = this.handlers.get(query.type);
    if (!handler) throw new Error(`No handler for ${query.type}`);

    return handler.execute(query);
  }
}