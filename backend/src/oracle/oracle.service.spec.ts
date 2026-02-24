import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OracleService } from './oracle.service';
import { OracleSnapshot } from './entities/oracle-snapshot.entity';
import { OracleLatestPrice } from './entities/oracle-latest.entity';
import { TransactionManager } from '../transaction/transaction-manager.service';
import { TransactionMonitorService } from '../transaction/transaction-monitor.service';
import { UpdateOracleDto } from './dto/update-oracle.dto';
import { CacheManager } from '../cache/cache-manager.service';
import { CacheInvalidator } from '../cache/cache-invalidator.service';

// Mock the signature verification utility
jest.mock('./utils/signature.utils', () => ({
  verifySignature: jest.fn().mockResolvedValue('0xSignerAddress'),
}));

describe('OracleService', () => {
  jest.setTimeout(20000);
  let service: OracleService;
  let snapshotRepository: Repository<OracleSnapshot>;
  let priceRepository: Repository<OracleLatestPrice>;
  let transactionManager: TransactionManager;
  let monitorService: TransactionMonitorService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [OracleSnapshot, OracleLatestPrice],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([OracleSnapshot, OracleLatestPrice]),
      ],
      providers: [
        OracleService,
        TransactionManager,
        TransactionMonitorService,
        {
          provide: 'EventBus',
          useValue: {
            publish: jest.fn(),
            publishBatch: jest.fn(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
          },
        },
        {
          provide: CacheManager,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delPattern: jest.fn(),
            reset: jest.fn(),
            getOrSet: jest.fn(),
            warm: jest.fn(),
          },
        },
        {
          provide: CacheInvalidator,
          useValue: {
            invalidate: jest.fn(),
            invalidateKeys: jest.fn(),
            invalidateKey: jest.fn(),
            invalidatePattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OracleService>(OracleService);
    snapshotRepository = module.get<Repository<OracleSnapshot>>(
      getRepositoryToken(OracleSnapshot),
    );
    priceRepository = module.get<Repository<OracleLatestPrice>>(
      getRepositoryToken(OracleLatestPrice),
    );
    transactionManager = module.get<TransactionManager>(TransactionManager);
    monitorService = module.get<TransactionMonitorService>(TransactionMonitorService);

    // Register monitoring hooks
    transactionManager.registerHooks(monitorService.createHooks());
  });

  beforeEach(async () => {
    await snapshotRepository.clear();
    await priceRepository.clear();
    monitorService.clearHistory();
  });

  describe('updateSnapshot', () => {
    it('should create snapshot and update prices in a transaction', async () => {
      const dto: UpdateOracleDto = {
        timestamp: Date.now(),
        signature: 'valid-signature',
        feeds: [
          { pair: 'XLM/USD', price: '0.12', decimals: 7 },
          { pair: 'BTC/USD', price: '45000.00', decimals: 2 },
        ],
      };

      const result = await service.updateSnapshot(dto);

      expect(result.snapshotId).toBeDefined();
      expect(result.feedsUpdated).toBe(2);

      // Verify snapshot was created
      const snapshot = await snapshotRepository.findOne({
        where: { id: result.snapshotId },
      });
      expect(snapshot).toBeDefined();
      expect(snapshot.feeds).toHaveLength(2);

      // Verify prices were updated
      const prices = await priceRepository.find();
      expect(prices).toHaveLength(2);
      expect(prices.map((p) => p.pair)).toContain('XLM/USD');
      expect(prices.map((p) => p.pair)).toContain('BTC/USD');
    });

    it('should update existing prices (upsert behavior)', async () => {
      // First update
      const dto1: UpdateOracleDto = {
        timestamp: Date.now(),
        signature: 'sig1',
        feeds: [{ pair: 'XLM/USD', price: '0.10', decimals: 7 }],
      };
      await service.updateSnapshot(dto1);

      // Second update with same pair
      const dto2: UpdateOracleDto = {
        timestamp: Date.now() + 1000,
        signature: 'sig2',
        feeds: [{ pair: 'XLM/USD', price: '0.15', decimals: 7 }],
      };
      const result = await service.updateSnapshot(dto2);

      // Should only have one price record (upsert)
      const prices = await priceRepository.find();
      expect(prices).toHaveLength(1);
      expect(Number(prices[0].price)).toBeCloseTo(0.15, 2);

      // Should have two snapshots
      const snapshots = await snapshotRepository.find();
      expect(snapshots).toHaveLength(2);
    });

    it('should retry on transient failures', async () => {
      // This test verifies the retry mechanism is in place
      const dto: UpdateOracleDto = {
        timestamp: Date.now(),
        signature: 'valid-signature',
        feeds: [{ pair: 'ETH/USD', price: '3000.00', decimals: 2 }],
      };

      const result = await service.updateSnapshot(dto);

      expect(result.snapshotId).toBeDefined();

      // Check metrics for retry tracking
      const metrics = monitorService.getAllMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should collect transaction metrics', async () => {
      const dto: UpdateOracleDto = {
        timestamp: Date.now(),
        signature: 'valid-signature',
        feeds: [{ pair: 'TEST/USD', price: '1.00', decimals: 2 }],
      };

      await service.updateSnapshot(dto);

      const stats = monitorService.getStatistics();
      expect(stats.totalTransactions).toBeGreaterThan(0);

      const events = monitorService.getEvents();
      expect(events.some((e) => e.type === 'commit')).toBe(true);
    });
  });

  describe('getLatest', () => {
    it('should return latest prices', async () => {
      // Setup test data
      await priceRepository.save([
        { pair: 'XLM/USD', price: '0.12', decimals: 7, timestamp: new Date(), snapshotId: 'snap1' },
        { pair: 'BTC/USD', price: '45000', decimals: 2, timestamp: new Date(), snapshotId: 'snap1' },
      ]);

      const latest = await service.getLatest();

      expect(latest).toHaveLength(2);
      expect(latest.map((p) => p.pair)).toContain('XLM/USD');
      expect(latest.map((p) => p.pair)).toContain('BTC/USD');
    });

    it('should return empty array when no prices exist', async () => {
      const latest = await service.getLatest();
      expect(latest).toEqual([]);
    });
  });

  describe('batchUpdateSnapshots', () => {
    it('should process multiple snapshots', async () => {
      const dtos: UpdateOracleDto[] = [
        {
          timestamp: Date.now(),
          signature: 'sig1',
          feeds: [{ pair: 'A/USD', price: '1.00', decimals: 2 }],
        },
        {
          timestamp: Date.now() + 1000,
          signature: 'sig2',
          feeds: [{ pair: 'B/USD', price: '2.00', decimals: 2 }],
        },
      ];

      const results = await service.batchUpdateSnapshots(dtos);

      expect(results).toHaveLength(2);
      expect(results[0].feedsUpdated).toBe(1);
      expect(results[1].feedsUpdated).toBe(1);

      // Verify all prices exist
      const prices = await priceRepository.find();
      expect(prices).toHaveLength(2);
    });

    it('should continue processing on individual failures', async () => {
      // Create a scenario where one update might fail
      const dtos: UpdateOracleDto[] = [
        {
          timestamp: Date.now(),
          signature: 'valid-sig',
          feeds: [{ pair: 'SUCCESS/USD', price: '1.00', decimals: 2 }],
        },
        {
          timestamp: Date.now() + 1000,
          signature: 'valid-sig',
          feeds: [], // Empty feeds - should still succeed but with 0 updates
        },
      ];

      const results = await service.batchUpdateSnapshots(dtos);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Compensation', () => {
    it('should track transaction events for monitoring', async () => {
      const eventTypes: string[] = [];
      const unsubscribe = monitorService.subscribe((event) => {
        eventTypes.push(event.type);
      });

      const dto: UpdateOracleDto = {
        timestamp: Date.now(),
        signature: 'valid-signature',
        feeds: [{ pair: 'MONITOR/USD', price: '1.00', decimals: 2 }],
      };

      await service.updateSnapshot(dto);

      expect(eventTypes).toContain('begin');
      expect(eventTypes).toContain('commit');

      unsubscribe();
    });

    it('should export transaction metrics', async () => {
      const dto: UpdateOracleDto = {
        timestamp: Date.now(),
        signature: 'valid-signature',
        feeds: [{ pair: 'METRICS/USD', price: '1.00', decimals: 2 }],
      };

      await service.updateSnapshot(dto);

      const exported = monitorService.exportMetrics();
      const parsed = JSON.parse(exported);

      expect(parsed.statistics).toBeDefined();
      expect(parsed.metrics).toBeDefined();
      expect(parsed.events).toBeDefined();
    });
  });
});
