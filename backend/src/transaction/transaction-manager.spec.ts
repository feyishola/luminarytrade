import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, Entity, PrimaryGeneratedColumn, Column, Repository } from 'typeorm';
import { TransactionManager } from './transaction-manager.service';
import { TransactionMonitorService } from './transaction-monitor.service';
import { TransactionContext } from './transaction-context';
import { CustomOperation, InsertOperation, UpdateOperation, DeleteOperation } from './compensatable-operation';

// Test entity
@Entity('test_entities')
class TestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int' })
  value: number;
}

describe('TransactionManager', () => {
  let module: TestingModule;
  let transactionManager: TransactionManager;
  let monitorService: TransactionMonitorService;
  let dataSource: DataSource;
  let testRepository: Repository<TestEntity>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [TestEntity],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([TestEntity]),
      ],
      providers: [TransactionManager, TransactionMonitorService],
    }).compile();

    transactionManager = module.get<TransactionManager>(TransactionManager);
    monitorService = module.get<TransactionMonitorService>(TransactionMonitorService);
    dataSource = module.get<DataSource>(getDataSourceToken());
    testRepository = dataSource.getRepository(TestEntity);

    // Register monitoring hooks
    transactionManager.registerHooks(monitorService.createHooks());
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await testRepository.clear();
    monitorService.clearHistory();
  });

  describe('Basic Transaction Operations', () => {
    it('should execute a simple transaction successfully', async () => {
      const result = await transactionManager.execute(async (context) => {
        const entity = await context.manager.save(TestEntity, {
          name: 'test',
          value: 100,
        });
        return entity;
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('test');
      expect(result.value).toBe(100);

      // Verify entity was persisted
      const saved = await testRepository.findOne({ where: { id: result.id } });
      expect(saved).toBeDefined();
    });

    it('should rollback on error and execute compensation', async () => {
      const compensationSpy = jest.fn();

      await expect(
        transactionManager.execute(async (context) => {
          const operation = new CustomOperation(
            'TestOperation',
            async (manager) => {
              return await manager.save(TestEntity, { name: 'temp', value: 1 });
            },
            async () => {
              compensationSpy();
            },
          );

          context.registerOperation(operation);
          await operation.execute(context.manager);

          throw new Error('Intentional failure');
        }),
      ).rejects.toThrow('Intentional failure');

      // Compensation should have been called
      expect(compensationSpy).toHaveBeenCalled();

      // Entity should not exist (rolled back)
      const entities = await testRepository.find();
      expect(entities).toHaveLength(0);
    });

    it('should support nested transactions', async () => {
      const result = await transactionManager.execute(async (context) => {
        // Outer transaction operation
        const outerOp = new InsertOperation('OuterOp', TestEntity, { name: 'outer', value: 1 });
        context.registerOperation(outerOp);
        const outer = await outerOp.execute(context.manager);

        // Simulate nested transaction
        const nestedContext = new TransactionContext(context.manager, context);
        const innerOp = new InsertOperation('InnerOp', TestEntity, { name: 'inner', value: 2 });
        nestedContext.registerOperation(innerOp);
        const inner = await innerOp.execute(nestedContext.manager);

        return { outer, inner };
      });

      expect(result.outer).toBeDefined();
      expect(result.inner).toBeDefined();

      const entities = await testRepository.find();
      expect(entities).toHaveLength(2);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed transactions with exponential backoff', async () => {
      let attemptCount = 0;

      const result = await transactionManager.execute(
        async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error(`Attempt ${attemptCount} failed`);
          }
          return { success: true, attempts: attemptCount };
        },
        {
          maxRetries: 3,
          retryDelayMs: 10,
          exponentialBackoff: true,
        },
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);

      // Check metrics
      const metrics = monitorService.getAllMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].retryCount).toBe(2); // 2 retries before success
    });

    it('should fail after max retries exceeded', async () => {
      await expect(
        transactionManager.execute(
          async () => {
            throw new Error('Persistent failure');
          },
          {
            maxRetries: 2,
            retryDelayMs: 10,
            exponentialBackoff: false,
          },
        ),
      ).rejects.toThrow('Persistent failure');

      const metrics = monitorService.getAllMetrics();
      expect(metrics[0].retryCount).toBe(2);
      expect(metrics[0].success).toBe(false);
    });
  });

  describe('Transaction Timeout', () => {
    it('should timeout long-running transactions', async () => {
      await expect(
        transactionManager.execute(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return { completed: true };
          },
          {
            timeoutMs: 50,
            maxRetries: 0,
          },
        ),
      ).rejects.toThrow('timed out');
    });
  });

  describe('Compensatable Operations', () => {
    it('should compensate InsertOperation on rollback', async () => {
      await expect(
        transactionManager.execute(async (context) => {
          const operation = new InsertOperation('TestInsert', TestEntity, {
            name: 'compensate-test',
            value: 999,
          });
          context.registerOperation(operation);
          await operation.execute(context.manager);

          // Verify it was inserted
          const inserted = await testRepository.findOne({
            where: { name: 'compensate-test' },
          });
          expect(inserted).toBeDefined();

          throw new Error('Trigger rollback');
        }),
      ).rejects.toThrow('Trigger rollback');

      // After rollback, entity should be deleted
      const remaining = await testRepository.find({
        where: { name: 'compensate-test' },
      });
      expect(remaining).toHaveLength(0);
    });

    it('should compensate UpdateOperation by restoring original values', async () => {
      // First create an entity
      const entity = await testRepository.save({
        name: 'update-test',
        value: 100,
      });

      await expect(
        transactionManager.execute(async (context) => {
          const operation = new UpdateOperation(
            'TestUpdate',
            TestEntity,
            { id: entity.id },
            { value: 200 },
          );
          context.registerOperation(operation);
          await operation.execute(context.manager);

          // Verify it was updated
          const updated = await testRepository.findOne({
            where: { id: entity.id },
          });
          expect(updated.value).toBe(200);

          throw new Error('Trigger rollback');
        }),
      ).rejects.toThrow('Trigger rollback');

      // After rollback, value should be restored
      const restored = await testRepository.findOne({
        where: { id: entity.id },
      });
      expect(restored.value).toBe(100);
    });

    it('should compensate DeleteOperation by restoring deleted entity', async () => {
      // First create an entity
      const entity = await testRepository.save({
        name: 'delete-test',
        value: 300,
      });

      await expect(
        transactionManager.execute(async (context) => {
          const operation = new DeleteOperation('TestDelete', TestEntity, {
            id: entity.id,
          });
          context.registerOperation(operation);
          await operation.execute(context.manager);

          // Verify it was deleted
          const deleted = await testRepository.findOne({
            where: { id: entity.id },
          });
          expect(deleted).toBeNull();

          throw new Error('Trigger rollback');
        }),
      ).rejects.toThrow('Trigger rollback');

      // After rollback, entity should be restored
      const restored = await testRepository.findOne({
        where: { id: entity.id },
      });
      expect(restored).toBeDefined();
      expect(restored.value).toBe(300);
    });
  });

  describe('Transaction Hooks', () => {
    it('should call lifecycle hooks in correct order', async () => {
      const hookOrder: string[] = [];

      transactionManager.registerHooks({
        beforeBegin: async () => { hookOrder.push('beforeBegin'); },
        afterBegin: async () => { hookOrder.push('afterBegin'); },
        beforeCommit: async () => { hookOrder.push('beforeCommit'); },
        afterCommit: async () => { hookOrder.push('afterCommit'); },
      });

      await transactionManager.execute(async () => {
        hookOrder.push('work');
        return { done: true };
      });

      expect(hookOrder).toEqual([
        'beforeBegin',
        'afterBegin',
        'work',
        'beforeCommit',
        'afterCommit',
      ]);
    });

    it('should call rollback hooks on failure', async () => {
      const hookOrder: string[] = [];

      transactionManager.registerHooks({
        beforeRollback: async () => { hookOrder.push('beforeRollback'); },
        afterRollback: async () => { hookOrder.push('afterRollback'); },
      });

      await expect(
        transactionManager.execute(async () => {
          throw new Error('Fail');
        }),
      ).rejects.toThrow('Fail');

      expect(hookOrder).toContain('beforeRollback');
      expect(hookOrder).toContain('afterRollback');
    });
  });

  describe('Transaction Monitoring', () => {
    it('should collect and report metrics', async () => {
      await transactionManager.execute(async () => ({
        result: 'success',
      }));

      const stats = monitorService.getStatistics();
      expect(stats.totalTransactions).toBe(1);
      expect(stats.successfulTransactions).toBe(1);
      expect(stats.failedTransactions).toBe(0);
    });

    it('should track transaction events', async () => {
      await transactionManager.execute(async () => ({
        result: 'success',
      }));

      const events = monitorService.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'commit')).toBe(true);
    });

    it('should allow subscribing to transaction events', async () => {
      const events: string[] = [];
      const unsubscribe = monitorService.subscribe((event) => {
        events.push(event.type);
      });

      await transactionManager.execute(async () => ({
        result: 'success',
      }));

      expect(events.length).toBeGreaterThan(0);

      unsubscribe();
    });
  });

  describe('Read-Only Transactions', () => {
    it('should support read-only transactions', async () => {
      // Pre-populate data
      await testRepository.save([
        { name: 'read1', value: 1 },
        { name: 'read2', value: 2 },
      ]);

      const result = await transactionManager.execute(
        async (context) => {
          return await context.manager.find(TestEntity);
        },
        { readOnly: true },
      );

      expect(result).toHaveLength(2);
    });
  });

  describe('Transaction Isolation Levels', () => {
    it('should support different isolation levels', async () => {
      const isolationLevels = [
        'READ UNCOMMITTED',
        'READ COMMITTED',
        'REPEATABLE READ',
        'SERIALIZABLE',
      ] as const;

      for (const level of isolationLevels) {
        const result = await transactionManager.execute(
          async () => ({ isolation: level }),
          { isolationLevel: level },
        );
        expect(result.isolation).toBe(level);
      }
    });
  });
});
