import { Test, TestingModule } from '@nestjs/testing';
import { EventStore } from '../event-store.service';
import { NestEventBus } from '../nest-event-bus.service';
import { EventStoreEntity } from '../entities/event-store.entity';
import { EventSnapshot } from '../entities/event-snapshot.entity';
import { AIResultCreatedEvent } from '../domain-events/ai-result.events';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('EventStore', () => {
  let service: EventStore;
  let eventRepository: Repository<EventStoreEntity>;
  let snapshotRepository: Repository<EventSnapshot>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventStore,
        {
          provide: getRepositoryToken(EventStoreEntity),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EventSnapshot),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventStore>(EventStore);
    eventRepository = module.get<Repository<EventStoreEntity>>(
      getRepositoryToken(EventStoreEntity),
    );
    snapshotRepository = module.get<Repository<EventSnapshot>>(
      getRepositoryToken(EventSnapshot),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveEvent', () => {
    it('should save an event successfully', async () => {
      const event = new AIResultCreatedEvent('test-id', {
        userId: 'user-123',
        provider: 'openai',
        request: { data: 'test' },
      });

      const savedEvent = { ...event, eventId: 'generated-id' };
      jest.spyOn(eventRepository, 'save').mockResolvedValue(savedEvent as any);

      const result = await service.saveEvent(event);

      expect(eventRepository.save).toHaveBeenCalled();
      expect(result).toEqual(savedEvent);
    });
  });

  describe('getEvents', () => {
    it('should retrieve events with filters', async () => {
      const mockEvents = [
        {
          eventId: '1',
          aggregateId: 'test-id',
          aggregateType: 'AIResult',
          eventType: 'AIResultCreated',
          payload: {},
          version: 1,
          timestamp: new Date(),
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEvents),
      };

      jest.spyOn(eventRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getEvents({
        aggregateId: 'test-id',
        eventType: 'AIResultCreated',
      });

      expect(result).toEqual(mockEvents);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot successfully', async () => {
      const snapshotData = { currentState: 'test' };
      const savedSnapshot = {
        id: 'snapshot-id',
        aggregateId: 'test-id',
        aggregateType: 'AIResult',
        data: snapshotData,
        version: 1,
        timestamp: new Date(),
      };

      jest.spyOn(snapshotRepository, 'save').mockResolvedValue(savedSnapshot as any);

      const result = await service.createSnapshot(
        'test-id',
        'AIResult',
        snapshotData,
        1,
      );

      expect(snapshotRepository.save).toHaveBeenCalled();
      expect(result).toEqual(savedSnapshot);
    });
  });
});
