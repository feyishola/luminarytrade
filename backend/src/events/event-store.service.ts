import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, FindOptionsWhere, DataSource, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { EventStoreEntity } from './entities/event-store.entity';
import { DomainEvent } from './domain-events/domain-event.base';
import { EventSnapshot } from './entities/event-snapshot.entity';

export interface EventFilter {
  aggregateId?: string;
  aggregateType?: string;
  eventType?: string;
  fromVersion?: number;
  toVersion?: number;
  fromDate?: Date;
  toDate?: Date;
  correlationId?: string;
}

export interface EventStream {
  aggregateId: string;
  aggregateType: string;
  events: DomainEvent[];
  version: number;
}

@Injectable()
export class EventStore {
  private readonly logger = new Logger(EventStore.name);

  constructor(
    @InjectRepository(EventStoreEntity)
    private eventRepository: Repository<EventStoreEntity>,
    @InjectRepository(EventSnapshot)
    private snapshotRepository: Repository<EventSnapshot>,
  ) {}

  async saveEvent(
    event: DomainEvent,
    manager?: EntityManager,
  ): Promise<EventStoreEntity> {
    const repo = manager ? manager.getRepository(EventStoreEntity) : this.eventRepository;
    
    const eventEntity = new EventStoreEntity();
    eventEntity.aggregateId = event.aggregateId;
    eventEntity.aggregateType = event.aggregateType;
    eventEntity.eventType = event.eventType;
    eventEntity.payload = event.payload;
    eventEntity.metadata = event.metadata;
    eventEntity.version = event.version;
    eventEntity.timestamp = event.timestamp;
    eventEntity.correlationId = event.correlationId;
    eventEntity.causationId = event.causationId;

    const saved = await repo.save(eventEntity);
    this.logger.debug(
      `Event saved: ${event.eventType} for aggregate ${event.aggregateId} v${event.version}`,
    );
    
    return saved;
  }

  async saveEvents(
    events: DomainEvent[],
    manager?: EntityManager,
  ): Promise<EventStoreEntity[]> {
    const repo = manager ? manager.getRepository(EventStoreEntity) : this.eventRepository;
    const eventEntities = events.map(event => {
      const eventEntity = new EventStoreEntity();
      eventEntity.aggregateId = event.aggregateId;
      eventEntity.aggregateType = event.aggregateType;
      eventEntity.eventType = event.eventType;
      eventEntity.payload = event.payload;
      eventEntity.metadata = event.metadata;
      eventEntity.version = event.version;
      eventEntity.timestamp = event.timestamp;
      eventEntity.correlationId = event.correlationId;
      eventEntity.causationId = event.causationId;
      return eventEntity;
    });

    const saved = await repo.save(eventEntities);
    this.logger.debug(
      `Batch saved ${events.length} events for aggregate ${events[0]?.aggregateId}`,
    );
    
    return saved;
  }

  async getEvents(
    filter: EventFilter,
    limit: number = 100,
    offset: number = 0,
  ): Promise<EventStoreEntity[]> {
    const where: FindOptionsWhere<EventStoreEntity> = {};

    if (filter.aggregateId) where.aggregateId = filter.aggregateId;
    if (filter.aggregateType) where.aggregateType = filter.aggregateType;
    if (filter.eventType) where.eventType = filter.eventType;
    if (filter.correlationId) where.correlationId = filter.correlationId;

    const queryBuilder = this.eventRepository.createQueryBuilder('event')
      .where(where)
      .orderBy('event.timestamp', 'ASC')
      .addOrderBy('event.version', 'ASC')
      .take(limit)
      .skip(offset);

    if (filter.fromVersion !== undefined) {
      queryBuilder.andWhere('event.version >= :fromVersion', { fromVersion: filter.fromVersion });
    }
    if (filter.toVersion !== undefined) {
      queryBuilder.andWhere('event.version <= :toVersion', { toVersion: filter.toVersion });
    }
    if (filter.fromDate) {
      queryBuilder.andWhere('event.timestamp >= :fromDate', { fromDate: filter.fromDate });
    }
    if (filter.toDate) {
      queryBuilder.andWhere('event.timestamp <= :toDate', { toDate: filter.toDate });
    }

    return queryBuilder.getMany();
  }

  async getEventStream(
    aggregateId: string,
    aggregateType: string,
    fromVersion: number = 0,
  ): Promise<EventStream> {
    const queryBuilder = this.eventRepository.createQueryBuilder('event')
      .where('event.aggregateId = :aggregateId', { aggregateId })
      .andWhere('event.aggregateType = :aggregateType', { aggregateType })
      .andWhere('event.version >= :fromVersion', { fromVersion })
      .orderBy('event.version', 'ASC');

    const events = await queryBuilder.getMany();

    if (events.length === 0 && fromVersion === 0) {
      throw new Error(`Event stream not found for aggregate ${aggregateId}`);
    }

    const domainEvents = events.map(eventEntity => 
      DomainEvent.fromEventStore(eventEntity)
    );

    const latestVersion = events.length > 0 
      ? Math.max(...events.map(e => e.version))
      : fromVersion - 1;

    return {
      aggregateId,
      aggregateType,
      events: domainEvents,
      version: latestVersion,
    };
  }

  async getLatestVersion(
    aggregateId: string,
    aggregateType: string,
  ): Promise<number> {
    const latestEvent = await this.eventRepository.findOne({
      where: { aggregateId, aggregateType },
      order: { version: 'DESC' },
      select: ['version'],
    });

    return latestEvent?.version || 0;
  }

  async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    data: Record<string, any>,
    version: number,
    manager?: EntityManager,
  ): Promise<EventSnapshot> {
    const repo = manager ? manager.getRepository(EventSnapshot) : this.snapshotRepository;
    
    const snapshot = new EventSnapshot();
    snapshot.aggregateId = aggregateId;
    snapshot.aggregateType = aggregateType;
    snapshot.data = data;
    snapshot.version = version;
    snapshot.timestamp = new Date();

    const saved = await repo.save(snapshot);
    this.logger.debug(
      `Snapshot created for ${aggregateType} ${aggregateId} at version ${version}`,
    );
    
    return saved;
  }

  async getLatestSnapshot(
    aggregateId: string,
    aggregateType: string,
  ): Promise<EventSnapshot | null> {
    return this.snapshotRepository.findOne({
      where: { aggregateId, aggregateType },
      order: { version: 'DESC' },
    });
  }

  async deleteEvents(
    aggregateId: string,
    aggregateType: string,
    manager?: EntityManager,
  ): Promise<void> {
    const eventRepo = manager ? manager.getRepository(EventStoreEntity) : this.eventRepository;
    await eventRepo.delete({ aggregateId, aggregateType });
    
    const snapshotRepo = manager ? manager.getRepository(EventSnapshot) : this.snapshotRepository;
    await snapshotRepo.delete({ aggregateId, aggregateType });
    
    this.logger.debug(`Deleted events and snapshots for ${aggregateType} ${aggregateId}`);
  }

  async countEvents(filter: EventFilter): Promise<number> {
    const where: FindOptionsWhere<EventStoreEntity> = {};

    if (filter.aggregateId) where.aggregateId = filter.aggregateId;
    if (filter.aggregateType) where.aggregateType = filter.aggregateType;
    if (filter.eventType) where.eventType = filter.eventType;
    if (filter.correlationId) where.correlationId = filter.correlationId;

    return this.eventRepository.count({ where });
  }
}
