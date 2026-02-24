import { Test, TestingModule } from '@nestjs/testing';
import { AIOrchestrationService } from '../../compute-bridge/service/ai-orchestration.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AIResultEntity } from '../../compute-bridge/entities/ai-result-entity';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../../audit/audit-log.service';
import { AdapterFactory } from '../../adapters/factory/adapter.factory';
import { AdapterRegistry } from '../../adapters/registry/adapter.registry';
import { NestEventBus } from '../nest-event-bus.service';
import { AIResultCreatedEvent } from '../domain-events/ai-result.events';

describe('AIOrchestrationService Integration', () => {
  let service: AIOrchestrationService;
  let eventBus: NestEventBus;
  let aiResultRepository: Repository<AIResultEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIOrchestrationService,
        {
          provide: getRepositoryToken(AIResultEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logEvent: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: AdapterFactory,
          useValue: {
            executeWalletOperationWithProtection: jest.fn(),
            executeAIOperationWithProtection: jest.fn(),
          },
        },
        {
          provide: AdapterRegistry,
          useValue: {
            getAIAdapter: jest.fn(),
            getWalletAdapter: jest.fn(),
          },
        },
        {
          provide: 'EventBus',
          useValue: {
            publish: jest.fn().mockResolvedValue(),
          },
        },
      ],
    }).compile();

    service = module.get<AIOrchestrationService>(AIOrchestrationService);
    eventBus = module.get<NestEventBus>('EventBus');
    aiResultRepository = module.get<Repository<AIResultEntity>>(
      getRepositoryToken(AIResultEntity),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scoreUser', () => {
    it('should emit AIResultCreatedEvent when creating a scoring request', async () => {
      const request = {
        userId: 'user-123',
        userData: { credit: 'good' },
        preferredProvider: 'openai',
      };

      const mockAIResult = {
        id: 'result-id',
        userId: request.userId,
        provider: request.preferredProvider,
        status: 'pending',
        request: request.userData,
        retryCount: 0,
      };

      jest.spyOn(aiResultRepository, 'create').mockReturnValue(mockAIResult as any);
      jest.spyOn(aiResultRepository, 'save').mockResolvedValue(mockAIResult as any);

      await service.scoreUser(request);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'AIResultCreated',
          aggregateId: 'result-id',
          payload: expect.objectContaining({
            userId: 'user-123',
            provider: 'openai',
            request: request.userData,
          }),
        }),
      );
    });
  });
});
