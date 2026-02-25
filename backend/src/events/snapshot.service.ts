import { Injectable, Logger } from '@nestjs/common';
import { EventStore } from './event-store.service';
import { DomainEvent } from './domain-events/domain-event.base';
import { IEventBus } from './interfaces/event-bus.interface';

export interface SnapshotService {
  createSnapshot(aggregateId: string, aggregateType: string, data: Record<string, any>): Promise<void>;
  getSnapshot(aggregateId: string, aggregateType: string): Promise<Record<string, any> | null>;
  restoreFromSnapshot(aggregateId: string, aggregateType: string): Promise<void>;
}

@Injectable()
export class DefaultSnapshotService implements SnapshotService {
  private readonly logger = new Logger(DefaultSnapshotService.name);

  constructor(private readonly eventStore: EventStore) {}

  async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    data: Record<string, any>,
  ): Promise<void> {
    const latestVersion = await this.eventStore.getLatestVersion(aggregateId, aggregateType);
    
    await this.eventStore.createSnapshot(aggregateId, aggregateType, data, latestVersion);
    
    this.logger.log(
      `Created snapshot for ${aggregateType} ${aggregateId} at version ${latestVersion}`
    );
  }

  async getSnapshot(
    aggregateId: string,
    aggregateType: string,
  ): Promise<Record<string, any> | null> {
    const snapshot = await this.eventStore.getLatestSnapshot(aggregateId, aggregateType);
    
    return snapshot ? snapshot.data : null;
  }

  async restoreFromSnapshot(
    aggregateId: string,
    aggregateType: string,
  ): Promise<void> {
    const snapshot = await this.eventStore.getLatestSnapshot(aggregateId, aggregateType);
    
    if (!snapshot) {
      throw new Error(`No snapshot found for ${aggregateType} ${aggregateId}`);
    }

    this.logger.log(
      `Restored ${aggregateType} ${aggregateId} from snapshot at version ${snapshot.version}`
    );
  }
}
