import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '../domain-events/domain-event.base';
import { IEventBus, IEventHandler, DeadLetterEvent, EventBusConfig } from '../interfaces/event-bus.interface';
import { EventStore } from './event-store.service';

@Injectable()
export class NestEventBus implements IEventBus, OnModuleInit {
  private readonly logger = new Logger(NestEventBus.name);
  private readonly handlers = new Map<string, Set<IEventHandler>>();
  private readonly deadLetterQueue: DeadLetterEvent[] = [];
  private readonly config: EventBusConfig;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly eventStore: EventStore,
  ) {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      enableDeadLetterQueue: true,
      enableMetrics: true,
    };
  }

  onModuleInit() {
    this.logger.log('Event Bus initialized');
  }

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    try {
      // Store event in event store
      await this.eventStore.saveEvent(event);

      // Emit event to handlers
      this.eventEmitter.emit(event.eventType, event);

      this.logger.debug(`Event published: ${event.eventType} for ${event.aggregateId}`);
      
      if (this.config.enableMetrics) {
        this.incrementEventMetric(event.eventType);
      }
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.eventType}:`, error);
      
      if (this.config.enableDeadLetterQueue) {
        await this.addToDeadLetterQueue(event, error);
      }
      
      throw error;
    }
  }

  async publishBatch<T extends DomainEvent>(events: T[]): Promise<void> {
    try {
      // Store events in event store
      await this.eventStore.saveEvents(events);

      // Emit events to handlers
      for (const event of events) {
        this.eventEmitter.emit(event.eventType, event);
        
        if (this.config.enableMetrics) {
          this.incrementEventMetric(event.eventType);
        }
      }

      this.logger.debug(`Batch published ${events.length} events`);
    } catch (error) {
      this.logger.error(`Failed to publish event batch:`, error);
      
      if (this.config.enableDeadLetterQueue) {
        for (const event of events) {
          await this.addToDeadLetterQueue(event, error);
        }
      }
      
      throw error;
    }
  }

  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
      
      // Subscribe to EventEmitter2
      this.eventEmitter.on(eventType, async (event: DomainEvent) => {
        await this.handleEvent(event, handler);
      });
    }
    
    this.handlers.get(eventType)!.add(handler);
    this.logger.debug(`Handler subscribed to ${eventType}`);
  }

  unsubscribe(eventType: string, handler: IEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
        this.eventEmitter.removeAllListeners(eventType);
      }
      this.logger.debug(`Handler unsubscribed from ${eventType}`);
    }
  }

  private async handleEvent(
    event: DomainEvent,
    handler: IEventHandler,
  ): Promise<void> {
    try {
      await handler.handle(event);
      this.logger.debug(`Event handled: ${event.eventType} by ${handler.constructor.name}`);
    } catch (error) {
      this.logger.error(
        `Handler ${handler.constructor.name} failed to process event ${event.eventType}:`,
        error,
      );
      
      // Retry logic with exponential backoff
      await this.retryEventHandling(event, handler, error);
    }
  }

  private async retryEventHandling(
    event: DomainEvent,
    handler: IEventHandler,
    originalError: Error,
  ): Promise<void> {
    let retryCount = 0;
    let delay = this.config.retryDelayMs;

    while (retryCount < this.config.maxRetries) {
      retryCount++;
      
      try {
        // Exponential backoff
        await this.sleep(delay);
        
        await handler.handle(event);
        this.logger.debug(
          `Event ${event.eventType} retried successfully on attempt ${retryCount}`,
        );
        return;
      } catch (error) {
        this.logger.warn(
          `Retry ${retryCount} failed for event ${event.eventType}:`,
          error,
        );
        
        delay *= 2; // Exponential backoff
      }
    }

    // All retries exhausted
    this.logger.error(
      `All retries exhausted for event ${event.eventType}`,
      originalError,
    );
    
    if (this.config.enableDeadLetterQueue) {
      await this.addToDeadLetterQueue(event, originalError, retryCount);
    }
  }

  private async addToDeadLetterQueue(
    event: DomainEvent,
    error: Error,
    retryCount: number = 0,
  ): Promise<void> {
    const deadLetterEvent: DeadLetterEvent = {
      event,
      error,
      timestamp: new Date(),
      retryCount,
    };

    this.deadLetterQueue.push(deadLetterEvent);
    this.logger.warn(
      `Event added to dead letter queue: ${event.eventType}`,
    );
  }

  getDeadLetterQueue(): DeadLetterEvent[] {
    return [...this.deadLetterQueue];
  }

  async retryDeadLetterEvents(): Promise<void> {
    const eventsToRetry = [...this.deadLetterQueue];
    this.deadLetterQueue.length = 0; // Clear the queue

    for (const deadLetterEvent of eventsToRetry) {
      try {
        await this.publish(deadLetterEvent.event);
        this.logger.debug(
          `Dead letter event retried successfully: ${deadLetterEvent.event.eventType}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to retry dead letter event ${deadLetterEvent.event.eventType}:`,
          error,
        );
        // Add back to queue if retry fails
        this.deadLetterQueue.push(deadLetterEvent);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private incrementEventMetric(eventType: string): void {
    // This would integrate with your metrics system (e.g., Prometheus)
    // For now, we'll just log
    this.logger.debug(`Metric incremented for event type: ${eventType}`);
  }

  getMetrics(): Record<string, any> {
    return {
      handlersCount: Array.from(this.handlers.values()).reduce(
        (total, handlers) => total + handlers.size,
        0,
      ),
      deadLetterQueueSize: this.deadLetterQueue.length,
      subscribedEventTypes: Array.from(this.handlers.keys()),
    };
  }
}
