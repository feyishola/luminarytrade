import { EventReplayService } from '../event-replay.service';
import { EventStore } from '../event-store.service';
import { AIResultCreatedEvent } from '../domain-events/ai-result.events';
import { IEventBus } from '../interfaces/event-bus.interface';

describe('EventReplayService', () => {
  let service: EventReplayService;
  let eventStore: EventStore;
  let eventBus: IEventBus;

  beforeEach(() => {
    eventStore = {
      getEventStream: jest.fn(),
      getEvents: jest.fn(),
      getLatestVersion: jest.fn(),
      createSnapshot: jest.fn(),
      getLatestSnapshot: jest.fn(),
    } as unknown as EventStore;
    eventBus = {
      publish: jest.fn(),
      publishBatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    } as unknown as IEventBus;

    service = new EventReplayService(eventStore, eventBus);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('replayEventsForAggregate', () => {
    it('should replay events for a specific aggregate', async () => {
      const aggregateId = 'test-id';
      const aggregateType = 'AIResult';
      const events = [
        new AIResultCreatedEvent(aggregateId, {
          userId: 'user-123',
          provider: 'openai',
          request: { data: 'test' },
        }),
      ];

      const mockEventStream = {
        aggregateId,
        aggregateType,
        events,
        version: 1,
      };

      jest.spyOn(eventStore, 'getEventStream').mockResolvedValue(mockEventStream);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const result = await service.replayEventsForAggregate(aggregateId, aggregateType);

      expect(eventStore.getEventStream).toHaveBeenCalledWith(aggregateId, aggregateType, 0);
      expect(eventBus.publish).toHaveBeenCalledTimes(events.length);
      expect(result.success).toBe(true);
      expect(result.eventsReplayed).toBe(events.length);
    });

    it('should handle replay errors gracefully', async () => {
      const aggregateId = 'test-id';
      const aggregateType = 'AIResult';

      jest.spyOn(eventStore, 'getEventStream').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.replayEventsForAggregate(aggregateId, aggregateType);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(result.eventsReplayed).toBe(0);
    });
  });

  describe('createSnapshotForAggregate', () => {
    it('should create a snapshot for an aggregate', async () => {
      const aggregateId = 'test-id';
      const aggregateType = 'AIResult';
      const snapshotData = { currentState: 'test' };
      const latestVersion = 5;

      jest.spyOn(eventStore, 'getLatestVersion').mockResolvedValue(latestVersion);
      jest.spyOn(eventStore, 'createSnapshot').mockResolvedValue({} as any);

      await service.createSnapshotForAggregate(aggregateId, aggregateType, snapshotData);

      expect(eventStore.getLatestVersion).toHaveBeenCalledWith(aggregateId, aggregateType);
      expect(eventStore.createSnapshot).toHaveBeenCalledWith(
        aggregateId,
        aggregateType,
        snapshotData,
        latestVersion,
      );
    });
  });

  describe('replayFromSnapshot', () => {
    it('should replay events from a snapshot', async () => {
      const aggregateId = 'test-id';
      const aggregateType = 'AIResult';
      const snapshot = {
        id: 'snapshot-id',
        aggregateId,
        aggregateType,
        data: { currentState: 'test' },
        version: 3,
        timestamp: new Date(),
      };

      jest.spyOn(eventStore, 'getLatestSnapshot').mockResolvedValue(snapshot as any);
      jest.spyOn(service, 'replayEventsForAggregate').mockResolvedValue({
        aggregateId,
        aggregateType,
        eventsReplayed: 2,
        success: true,
      });

      const result = await service.replayFromSnapshot(aggregateId, aggregateType);

      expect(eventStore.getLatestSnapshot).toHaveBeenCalledWith(aggregateId, aggregateType);
      expect(service.replayEventsForAggregate).toHaveBeenCalledWith(aggregateId, aggregateType, {
        fromVersion: 4,
      });
      expect(result.success).toBe(true);
    });

    it('should throw error when no snapshot exists', async () => {
      const aggregateId = 'test-id';
      const aggregateType = 'AIResult';

      jest.spyOn(eventStore, 'getLatestSnapshot').mockResolvedValue(null);

      await expect(
        service.replayFromSnapshot(aggregateId, aggregateType),
      ).rejects.toThrow('No snapshot found for AIResult test-id');
    });
  });
});
