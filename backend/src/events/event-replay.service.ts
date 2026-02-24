import { Injectable, Logger } from '@nestjs/common';
import { EventStore } from './event-store.service';
import { EventStream, DomainEvent } from './domain-events/domain-event.base';
import { IEventBus } from './interfaces/event-bus.interface';

export interface ReplayOptions {
  fromVersion?: number;
  toVersion?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  batchSize?: number;
  delayMs?: number;
}

export interface ReplayResult {
  aggregateId: string;
  aggregateType: string;
  eventsReplayed: number;
  success: boolean;
  error?: string;
}

@Injectable()
export class EventReplayService {
  private readonly logger = new Logger(EventReplayService.name);

  constructor(
    private readonly eventStore: EventStore,
    private readonly eventBus: IEventBus,
  ) {}

  async replayEventsForAggregate(
    aggregateId: string,
    aggregateType: string,
    options: ReplayOptions = {},
  ): Promise<ReplayResult> {
    try {
      this.logger.log(`Starting replay for ${aggregateType} ${aggregateId}`);

      const eventStream = await this.eventStore.getEventStream(
        aggregateId,
        aggregateType,
        options.fromVersion || 0,
      );

      let eventsToReplay = eventStream.events;

      // Filter by version range
      if (options.fromVersion !== undefined) {
        eventsToReplay = eventsToReplay.filter(
          event => event.version >= options.fromVersion!
        );
      }
      if (options.toVersion !== undefined) {
        eventsToReplay = eventsToReplay.filter(
          event => event.version <= options.toVersion!
        );
      }

      // Filter by timestamp range
      if (options.fromTimestamp) {
        eventsToReplay = eventsToReplay.filter(
          event => event.timestamp >= options.fromTimestamp!
        );
      }
      if (options.toTimestamp) {
        eventsToReplay = eventsToReplay.filter(
          event => event.timestamp <= options.toTimestamp!
        );
      }

      // Replay events in batches
      const batchSize = options.batchSize || 100;
      const delayMs = options.delayMs || 0;

      for (let i = 0; i < eventsToReplay.length; i += batchSize) {
        const batch = eventsToReplay.slice(i, i + batchSize);
        
        for (const event of batch) {
          await this.eventBus.publish(event);
          
          if (delayMs > 0) {
            await this.sleep(delayMs);
          }
        }

        this.logger.debug(
          `Replayed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(eventsToReplay.length / batchSize)}`
        );
      }

      this.logger.log(
        `Successfully replayed ${eventsToReplay.length} events for ${aggregateType} ${aggregateId}`
      );

      return {
        aggregateId,
        aggregateType,
        eventsReplayed: eventsToReplay.length,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Failed to replay events for ${aggregateType} ${aggregateId}:`,
        error
      );

      return {
        aggregateId,
        aggregateType,
        eventsReplayed: 0,
        success: false,
        error: error.message,
      };
    }
  }

  async replayEventsByType(
    eventType: string,
    options: ReplayOptions = {},
  ): Promise<ReplayResult[]> {
    this.logger.log(`Starting replay for event type ${eventType}`);

    const events = await this.eventStore.getEvents({
      eventType,
      fromDate: options.fromTimestamp,
      toDate: options.toTimestamp,
    });

    // Group events by aggregate
    const eventsByAggregate = new Map<string, DomainEvent[]>();
    
    for (const event of events) {
      const key = `${event.aggregateType}:${event.aggregateId}`;
      if (!eventsByAggregate.has(key)) {
        eventsByAggregate.set(key, []);
      }
      eventsByAggregate.get(key)!.push(DomainEvent.fromEventStore(event));
    }

    const results: ReplayResult[] = [];

    for (const [key, aggregateEvents] of eventsByAggregate) {
      const [aggregateType, aggregateId] = key.split(':');
      
      const result = await this.replayEventsForAggregate(
        aggregateId,
        aggregateType,
        {
          ...options,
          fromVersion: undefined, // Already filtered by event type
          toVersion: undefined,
        },
      );
      
      results.push(result);
    }

    return results;
  }

  async replayAllEvents(options: ReplayOptions = {}): Promise<ReplayResult[]> {
    this.logger.log('Starting full event replay');

    // Get all unique aggregates
    const allEvents = await this.eventStore.getEvents({
      fromDate: options.fromTimestamp,
      toDate: options.toTimestamp,
    });

    const aggregates = new Map<string, { id: string; type: string }>();
    
    for (const event of allEvents) {
      const key = `${event.aggregateType}:${event.aggregateId}`;
      if (!aggregates.has(key)) {
        aggregates.set(key, {
          id: event.aggregateId,
          type: event.aggregateType,
        });
      }
    }

    const results: ReplayResult[] = [];

    for (const { id, type } of aggregates.values()) {
      const result = await this.replayEventsForAggregate(id, type, options);
      results.push(result);
    }

    return results;
  }

  async createSnapshotForAggregate(
    aggregateId: string,
    aggregateType: string,
    snapshotData: Record<string, any>,
  ): Promise<void> {
    const latestVersion = await this.eventStore.getLatestVersion(aggregateId, aggregateType);
    
    await this.eventStore.createSnapshot(
      aggregateId,
      aggregateType,
      snapshotData,
      latestVersion,
    );

    this.logger.log(
      `Created snapshot for ${aggregateType} ${aggregateId} at version ${latestVersion}`
    );
  }

  async replayFromSnapshot(
    aggregateId: string,
    aggregateType: string,
  ): Promise<ReplayResult> {
    const snapshot = await this.eventStore.getLatestSnapshot(aggregateId, aggregateType);
    
    if (!snapshot) {
      throw new Error(`No snapshot found for ${aggregateType} ${aggregateId}`);
    }

    this.logger.log(
      `Replaying ${aggregateType} ${aggregateId} from snapshot at version ${snapshot.version}`
    );

    // Replay events from the snapshot version onwards
    return this.replayEventsForAggregate(aggregateId, aggregateType, {
      fromVersion: snapshot.version + 1,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
