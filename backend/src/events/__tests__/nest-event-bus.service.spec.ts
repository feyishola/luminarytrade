import { Test, TestingModule } from '@nestjs/testing';
import { NestEventBus } from '../nest-event-bus.service';
import { EventStore } from '../event-store.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AIResultCreatedEvent } from '../domain-events/ai-result.events';
import { IEventHandler } from '../interfaces/event-bus.interface';

describe('NestEventBus', () => {
  let service: NestEventBus;
  let eventStore: EventStore;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NestEventBus,
        {
          provide: EventStore,
          useValue: {
            saveEvent: jest.fn(),
            saveEvents: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
            removeAllListeners: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NestEventBus>(NestEventBus);
    eventStore = module.get<EventStore>(EventStore);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should publish an event successfully', async () => {
      const event = new AIResultCreatedEvent('test-id', {
        userId: 'user-123',
        provider: 'openai',
        request: { data: 'test' },
      });

      jest.spyOn(eventStore, 'saveEvent').mockResolvedValue({} as any);
      jest.spyOn(eventEmitter, 'emit').mockImplementation(() => {});

      await service.publish(event);

      expect(eventStore.saveEvent).toHaveBeenCalledWith(event);
      expect(eventEmitter.emit).toHaveBeenCalledWith(event.eventType, event);
    });

    it('should handle publishing errors and add to dead letter queue', async () => {
      const event = new AIResultCreatedEvent('test-id', {
        userId: 'user-123',
        provider: 'openai',
        request: { data: 'test' },
      });

      const error = new Error('Test error');
      jest.spyOn(eventStore, 'saveEvent').mockRejectedValue(error);

      await expect(service.publish(event)).rejects.toThrow('Test error');

      const deadLetterQueue = service.getDeadLetterQueue();
      expect(deadLetterQueue).toHaveLength(1);
      expect(deadLetterQueue[0].event).toEqual(event);
      expect(deadLetterQueue[0].error).toEqual(error);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to an event type', () => {
      const handler: IEventHandler<AIResultCreatedEvent> = {
        handle: jest.fn(),
      };

      service.subscribe('AIResultCreated', handler);

      expect(eventEmitter.on).toHaveBeenCalledWith(
        'AIResultCreated',
        expect.any(Function),
      );
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from an event type', () => {
      const handler: IEventHandler<AIResultCreatedEvent> = {
        handle: jest.fn(),
      };

      service.subscribe('AIResultCreated', handler);
      service.unsubscribe('AIResultCreated', handler);

      expect(eventEmitter.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should return event bus metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('handlersCount');
      expect(metrics).toHaveProperty('deadLetterQueueSize');
      expect(metrics).toHaveProperty('subscribedEventTypes');
    });
  });
});
