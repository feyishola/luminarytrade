import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '../domain-events/domain-event.base';

export interface IEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface IEventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  publishBatch<T extends DomainEvent>(events: T[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void;
  unsubscribe(eventType: string, handler: IEventHandler): void;
}

export interface DeadLetterEvent {
  event: DomainEvent;
  error: Error;
  timestamp: Date;
  retryCount: number;
}

export interface EventBusConfig {
  maxRetries: number;
  retryDelayMs: number;
  enableDeadLetterQueue: boolean;
  enableMetrics: boolean;
}
