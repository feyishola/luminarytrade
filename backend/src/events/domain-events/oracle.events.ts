import { DomainEvent } from './domain-event.base';

export interface PriceFeed {
  pair: string;
  price: string;
  decimals: number;
}

export class OracleSnapshotRecordedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      signer: string;
      signature: string;
      feeds: PriceFeed[];
      timestamp: Date;
    },
    version: number = 1,
    metadata: Record<string, any> = {},
    correlationId?: string,
    causationId?: string,
  ) {
    super(
      aggregateId,
      'OracleSnapshot',
      'OracleSnapshotRecorded',
      payload,
      version,
      metadata,
      correlationId,
      causationId,
    );
  }
}

export class PriceFeedUpdatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      pair: string;
      price: string;
      decimals: number;
      previousPrice?: string;
      timestamp: Date;
      snapshotId: string;
    },
    version: number = 1,
    metadata: Record<string, any> = {},
    correlationId?: string,
    causationId?: string,
  ) {
    super(
      aggregateId,
      'OracleLatestPrice',
      'PriceFeedUpdated',
      payload,
      version,
      metadata,
      correlationId,
      causationId,
    );
  }
}
