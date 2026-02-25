import { Injectable, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RecordOracleSnapshotCommand } from '../commands';
import { OracleSnapshotRepository } from '../../domain/repositories.interface';
import { OracleSnapshot } from '../../domain/oracle/oracle-snapshot.aggregate';
import { OracleLatestPrice } from '../../domain/oracle/oracle-latest-price.entity';

@Injectable()
export class RecordOracleSnapshotHandler {
  constructor(
    private readonly snapshotRepository: OracleSnapshotRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: RecordOracleSnapshotCommand): Promise<OracleSnapshot> {
    const exists = await this.snapshotRepository.exists(command.snapshotId);
    if (exists) {
      throw new ConflictException(`Snapshot ${command.snapshotId} already exists`);
    }

    // Validate all required feeds are provided upfront (fail fast)
    const providedFeeds = new Set(command.prices.map((p) => p.feed));
    const missingFeeds = command.requiredFeeds.filter((f) => !providedFeeds.has(f));
    if (missingFeeds.length > 0) {
      throw new Error(
        `Cannot record snapshot: missing price data for feeds [${missingFeeds.join(', ')}]`,
      );
    }

    const snapshot = OracleSnapshot.create(command.snapshotId, {
      agentId: command.agentId,
      requiredFeeds: command.requiredFeeds,
    });

    // Record each price through the aggregate root
    for (const priceData of command.prices) {
      const price = OracleLatestPrice.create(
        priceData.feed,
        priceData.price,
        priceData.confidence,
        priceData.exponent,
        priceData.publishTime,
      );
      snapshot.recordPrice(price);
    }

    // Finalise enforces the invariant and emits the snapshot recorded event
    snapshot.finalise();

    await this.snapshotRepository.save(snapshot);
    this.publishEvents(snapshot);

    return snapshot;
  }

  private publishEvents(snapshot: OracleSnapshot): void {
    for (const event of snapshot.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    snapshot.clearDomainEvents();
  }
}
