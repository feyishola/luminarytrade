import { DomainEvent } from '../base/domain-event.base';

export class OracleSnapshotRecordedEvent extends DomainEvent {
  readonly eventType = 'oracle.snapshot_recorded';

  constructor(
    aggregateId: string,
    aggregateVersion: number,
    readonly payload: {
      agentId: string;
      feeds: string[];
      timestamp: Date;
    },
  ) {
    super(aggregateId, 'OracleSnapshot', aggregateVersion);
  }
}

export class OracleSnapshotPriceUpdatedEvent extends DomainEvent {
  readonly eventType = 'oracle.price_updated';

  constructor(
    aggregateId: string,
    aggregateVersion: number,
    readonly payload: {
      feed: string;
      previousPrice: number;
      newPrice: number;
    },
  ) {
    super(aggregateId, 'OracleSnapshot', aggregateVersion);
  }
}
