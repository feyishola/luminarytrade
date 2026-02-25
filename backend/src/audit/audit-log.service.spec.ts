import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLogEntity, AuditEventType } from './entities/audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: Repository<AuditLogEntity>;

  const mockAuditLog: AuditLogEntity = {
    id: 'test-id',
    wallet: 'test-wallet',
    eventType: AuditEventType.AI_SCORING_STARTED,
    metadata: { test: 'data' },
    description: 'Test event',
    relatedEntityId: 'entity-id',
    relatedEntityType: 'AIResult',
    timestamp: new Date(),
  };

  const mockRepository = {
    create: jest.fn().mockReturnValue(mockAuditLog),
    save: jest.fn().mockResolvedValue(mockAuditLog),
    findAndCount: jest.fn().mockResolvedValue([[mockAuditLog], 1]),
    find: jest.fn().mockResolvedValue([mockAuditLog]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLogEntity),
          useValue: mockRepository,
        },
        {
          provide: 'EventBus',
          useValue: {
            publish: jest.fn(),
            publishBatch: jest.fn(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    repository = module.get<Repository<AuditLogEntity>>(
      getRepositoryToken(AuditLogEntity),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logEvent', () => {
    it('should create and save an audit log', async () => {
      const wallet = 'test-wallet';
      const eventType = AuditEventType.AI_SCORING_STARTED;
      const metadata = { test: 'data' };
      const description = 'Test event';
      const relatedEntityId = 'entity-id';
      const relatedEntityType = 'AIResult';

      const result = await service.logEvent(
        wallet,
        eventType,
        metadata,
        description,
        relatedEntityId,
        relatedEntityType,
      );

      expect(repository.create).toHaveBeenCalledWith({
        wallet,
        eventType,
        metadata,
        description,
        relatedEntityId,
        relatedEntityType,
      });

      expect(repository.save).toHaveBeenCalledWith(mockAuditLog);
      expect(result).toEqual(mockAuditLog);
    });

    it('should handle optional parameters', async () => {
      const wallet = 'test-wallet';
      const eventType = AuditEventType.AI_SCORING_STARTED;

      await service.logEvent(wallet, eventType);

      expect(repository.create).toHaveBeenCalledWith({
        wallet,
        eventType,
        metadata: {},
        description: undefined,
        relatedEntityId: undefined,
        relatedEntityType: undefined,
      });
    });

    it('should log error when save fails', async () => {
      const error = new Error('Database error');
      jest.spyOn(repository, 'save').mockRejectedValueOnce(error);

      await expect(
        service.logEvent('wallet', AuditEventType.AI_SCORING_STARTED),
      ).rejects.toThrow(error);
    });
  });

  describe('fetchAuditLogs', () => {
    it('should fetch audit logs with filters', async () => {
      const query = {
        wallet: 'test-wallet',
        eventType: AuditEventType.AI_SCORING_STARTED,
        limit: 50,
        offset: 0,
      };

      const result = await service.fetchAuditLogs(query);

      expect(repository.findAndCount).toHaveBeenCalled();
      expect(result).toEqual({ logs: [mockAuditLog], total: 1 });
    });

    it('should fetch audit logs with date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      const query = {
        startDate,
        endDate,
        limit: 50,
        offset: 0,
      };

      await service.fetchAuditLogs(query);

      expect(repository.findAndCount).toHaveBeenCalled();
    });

    it('should apply default limit and offset', async () => {
      await service.fetchAuditLogs({});

      expect(repository.findAndCount).toHaveBeenCalled();
    });

    it('should handle query errors', async () => {
      const error = new Error('Query error');
      jest.spyOn(repository, 'findAndCount').mockRejectedValueOnce(error);

      await expect(service.fetchAuditLogs({})).rejects.toThrow(error);
    });
  });

  describe('getLogsByWallet', () => {
    it('should fetch logs by wallet', async () => {
      const wallet = 'test-wallet';

      const result = await service.getLogsByWallet(wallet);

      expect(repository.find).toHaveBeenCalledWith({
        where: { wallet },
        order: { timestamp: 'DESC' },
        take: 50,
      });

      expect(result).toEqual([mockAuditLog]);
    });

    it('should apply custom limit', async () => {
      const wallet = 'test-wallet';

      await service.getLogsByWallet(wallet, 100);

      expect(repository.find).toHaveBeenCalledWith({
        where: { wallet },
        order: { timestamp: 'DESC' },
        take: 100,
      });
    });
  });

  describe('getLogsByEventType', () => {
    it('should fetch logs by event type', async () => {
      const eventType = AuditEventType.AI_SCORING_COMPLETED;

      const result = await service.getLogsByEventType(eventType);

      expect(repository.find).toHaveBeenCalledWith({
        where: { eventType },
        order: { timestamp: 'DESC' },
        take: 50,
      });

      expect(result).toEqual([mockAuditLog]);
    });

    it('should apply custom limit', async () => {
      const eventType = AuditEventType.AI_SCORING_COMPLETED;

      await service.getLogsByEventType(eventType, 100);

      expect(repository.find).toHaveBeenCalledWith({
        where: { eventType },
        order: { timestamp: 'DESC' },
        take: 100,
      });
    });
  });

  describe('getLogsByRelatedEntity', () => {
    it('should fetch logs by related entity', async () => {
      const relatedEntityId = 'entity-id';

      const result = await service.getLogsByRelatedEntity(relatedEntityId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { relatedEntityId },
        order: { timestamp: 'DESC' },
        take: 50,
      });

      expect(result).toEqual([mockAuditLog]);
    });

    it('should apply custom limit', async () => {
      const relatedEntityId = 'entity-id';

      await service.getLogsByRelatedEntity(relatedEntityId, 100);

      expect(repository.find).toHaveBeenCalledWith({
        where: { relatedEntityId },
        order: { timestamp: 'DESC' },
        take: 100,
      });
    });
  });
});
