import { Injectable, UnauthorizedException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { UpdateOracleDto } from './dto/update-oracle.dto';
import * as process from 'process';
import { OracleSnapshot } from './entities/oracle-snapshot.entity';
import { OracleLatestPrice } from './entities/oracle-latest.entity';
import { verifySignature } from './utils/signature.utils';
import { TransactionManager } from '../transaction/transaction-manager.service';
import { TransactionContext } from '../transaction/transaction-context';
import { CustomOperation } from '../transaction/compensatable-operation';
import { IEventBus } from '../events/interfaces/event-bus.interface';
import { 
  OracleSnapshotRecordedEvent, 
  PriceFeedUpdatedEvent 
} from '../events/domain-events/oracle.events';
import { CacheManager } from '../cache/cache-manager.service';
import { CacheInvalidator } from '../cache/cache-invalidator.service';
import { Cacheable } from '../cache/decorators/cacheable.decorator';
import { CacheInvalidate } from '../cache/decorators/cache-invalidate.decorator';

export interface FeedPrice {
  pair: string;
  price: string;
  decimals: number;
}

export interface UpdateSnapshotResult {
  snapshotId: string;
  feedsUpdated: number;
}

@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);
  private readonly oracleSignerAddress: string;

  constructor(
    @InjectRepository(OracleSnapshot) private readonly snapshotRepo: Repository<OracleSnapshot>,
    @InjectRepository(OracleLatestPrice) private readonly latestRepo: Repository<OracleLatestPrice>,
    private readonly transactionManager: TransactionManager,
    @Inject("EventBus")
    private readonly eventBus: IEventBus,
    private readonly cacheManager: CacheManager,
    private readonly cacheInvalidator: CacheInvalidator,
  ) {
    this.oracleSignerAddress = process.env.ORACLE_SIGNER_ADDRESS;
  }

  /**
   * Update oracle snapshot with price feeds using transactional scope
   * with compensation pattern for rollback scenarios
   */
  @CacheInvalidate({ rule: 'oracle:snapshot' })
  async updateSnapshot(dto: UpdateOracleDto): Promise<UpdateSnapshotResult> {
    // Signature and timestamp validation are now handled by DTO decorators
    // We still need to recover the signer for the event and entity
    const recovered = await verifySignature(dto.signature, dto.timestamp, dto.feeds);
    const timestampDate = new Date(dto.timestamp > 1e12 ? dto.timestamp : dto.timestamp * 1000);

    // Execute with transaction manager - includes retry logic and compensation
    return this.transactionManager.execute<UpdateSnapshotResult>(
      async (context: TransactionContext) => {
        const { manager } = context;

        // Create snapshot using compensatable operation
        let savedSnapshotId: string = '';
        const snapshotOperation = new CustomOperation(
          'CreateOracleSnapshot',
          async (txnManager: EntityManager) => {
            const snapshot = txnManager.create(OracleSnapshot, {
              timestamp: timestampDate,
              signer: recovered,
              signature: dto.signature,
              feeds: dto.feeds,
            });
            const saved = await txnManager.save(OracleSnapshot, snapshot);
            savedSnapshotId = saved.id;
            return saved;
          },
          async (txnManager: EntityManager) => {
            // Compensation: delete the created snapshot
            if (savedSnapshotId) {
              await txnManager.delete(OracleSnapshot, { id: savedSnapshotId });
              this.logger.warn(`Compensated: Deleted snapshot ${savedSnapshotId}`);
            }
          },
        );

        // Register and execute the operation
        context.registerOperation(snapshotOperation);
        await snapshotOperation.execute(manager);

        // Update price feeds with individual compensatable operations
        const feedOperations: CustomOperation[] = [];
        const previousPrices = new Map<string, OracleLatestPrice>();

        for (const feed of dto.feeds) {
          const feedOperation = new CustomOperation(
            `UpdatePriceFeed_${feed.pair}`,
            async (txnManager: EntityManager) => {
              // Store previous price for compensation
              const existingPrice = await txnManager.findOne(OracleLatestPrice, {
                where: { pair: feed.pair },
              });
              
              if (existingPrice) {
                previousPrices.set(feed.pair, { ...existingPrice });
              }

              // Perform upsert using TypeORM's upsert method
              await txnManager.upsert(
                OracleLatestPrice,
                {
                  pair: feed.pair,
                  price: feed.price,
                  decimals: feed.decimals,
                  timestamp: timestampDate,
                  snapshotId: savedSnapshotId,
                },
                ['pair'],
              );

              return { pair: feed.pair, updated: true };
            },
            async () => {
              // Compensation: restore previous price or delete if it was new
              const previousPrice = previousPrices.get(feed.pair);
              
              if (previousPrice) {
                // Restore previous price
                await manager.upsert(
                  OracleLatestPrice,
                  {
                    pair: previousPrice.pair,
                    price: previousPrice.price,
                    decimals: previousPrice.decimals,
                    timestamp: previousPrice.timestamp,
                    snapshotId: previousPrice.snapshotId,
                  },
                  ['pair'],
                );
                this.logger.warn(`Compensated: Restored previous price for ${feed.pair}`);
              } else {
                // Delete the newly created price
                await manager.delete(OracleLatestPrice, { pair: feed.pair });
                this.logger.warn(`Compensated: Deleted new price for ${feed.pair}`);
              }
            },
          );

          feedOperations.push(feedOperation);
          context.registerOperation(feedOperation);
          await feedOperation.execute(manager);
        }

        this.logger.log(
          `Snapshot ${savedSnapshotId} created with ${dto.feeds.length} price feeds updated`,
        );

        // Emit Oracle Snapshot Recorded Event
        const oracleSnapshotEvent = new OracleSnapshotRecordedEvent(
          savedSnapshotId,
          {
            signer: recovered,
            signature: dto.signature,
            feeds: dto.feeds,
            timestamp: timestampDate,
          },
        );
        await this.eventBus.publish(oracleSnapshotEvent);

        // Emit Price Feed Updated Events for each feed
        for (const feed of dto.feeds) {
          const previousPrice = previousPrices.get(feed.pair);
          const priceFeedEvent = new PriceFeedUpdatedEvent(
            feed.pair,
            {
              pair: feed.pair,
              price: feed.price,
              decimals: feed.decimals,
              previousPrice: previousPrice?.price,
              timestamp: timestampDate,
              snapshotId: savedSnapshotId,
            },
          );
          await this.eventBus.publish(priceFeedEvent);
        }

        return {
          snapshotId: savedSnapshotId,
          feedsUpdated: dto.feeds.length,
        };
      },
      {
        maxRetries: 3,
        retryDelayMs: 100,
        exponentialBackoff: true,
        maxBackoffMs: 5000,
        timeoutMs: 30000,
        isolationLevel: 'READ COMMITTED',
      },
    );
  }

  /**
   * Get latest prices with optional caching
   */
  @Cacheable({
    key: 'latest',
    ttl: 60, // 1 minute
    namespace: 'oracle',
  })
  async getLatest(): Promise<FeedPrice[]> {
    const latest = await this.latestRepo.find();
    return latest.map((l) => ({
      pair: l.pair,
      price: l.price,
      decimals: l.decimals,
      timestamp: l.timestamp,
    }));
  }

  /**
   * Batch update multiple snapshots with transaction scope
   */
  async batchUpdateSnapshots(dtos: UpdateOracleDto[]): Promise<UpdateSnapshotResult[]> {
    const results: UpdateSnapshotResult[] = [];

    for (const dto of dtos) {
      try {
        const result = await this.updateSnapshot(dto);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to update snapshot in batch: ${(error as Error).message}`);
        // Continue with other snapshots - partial success is acceptable
      }
    }

    return results;
  }
}
