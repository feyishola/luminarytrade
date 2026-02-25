import { AggregateRoot } from '../base/aggregate-root.base';
import { OracleLatestPrice } from './oracle-latest-price.entity';
import { OracleSnapshotRecordedEvent, OracleSnapshotPriceUpdatedEvent } from './oracle-events';

export interface OracleSnapshotProps {
  agentId: string;
  requiredFeeds: string[];
  prices?: OracleLatestPrice[];
  timestamp?: Date;
}

export interface OracleSnapshotState {
  id: string;
  agentId: string;
  requiredFeeds: string[];
  prices: ReturnType<OracleLatestPrice['toPlain']>[];
  timestamp: Date;
  version: number;
}

/**
 * OracleSnapshot Aggregate Root
 *
 * Invariants:
 *  1. All required feeds must be present in prices
 *  2. No duplicate feed entries
 *  3. Prices must be recorded with timestamps
 */
export class OracleSnapshot extends AggregateRoot<string> {
  private _agentId: string;
  private _requiredFeeds: string[];
  private _prices: Map<string, OracleLatestPrice>;
  private _timestamp: Date;

  private constructor(id: string, props: OracleSnapshotProps, version: number) {
    super(id, version);
    this._agentId = props.agentId;
    this._requiredFeeds = [...props.requiredFeeds];
    this._prices = new Map();
    this._timestamp = props.timestamp ?? new Date();

    if (props.prices) {
      for (const price of props.prices) {
        this._prices.set(price.feed, price);
      }
    }
  }

  // ─── Factory ─────────────────────────────────────────────────────────────────

  static create(id: string, props: OracleSnapshotProps): OracleSnapshot {
    if (!props.agentId) throw new Error('agentId is required for OracleSnapshot');
    if (!props.requiredFeeds?.length) throw new Error('requiredFeeds must not be empty');

    return new OracleSnapshot(id, props, 0);
  }

  static reconstitute(state: OracleSnapshotState): OracleSnapshot {
    const prices = state.prices.map((p) => OracleLatestPrice.reconstitute(p));
    const snapshot = new OracleSnapshot(
      state.id,
      {
        agentId: state.agentId,
        requiredFeeds: state.requiredFeeds,
        prices,
        timestamp: state.timestamp,
      },
      state.version,
    );
    return snapshot;
  }

  // ─── Accessors ───────────────────────────────────────────────────────────────

  get agentId(): string { return this._agentId; }
  get requiredFeeds(): ReadonlyArray<string> { return [...this._requiredFeeds]; }
  get timestamp(): Date { return this._timestamp; }

  /** Only accessible through aggregate root */
  getPrice(feed: string): OracleLatestPrice | undefined {
    return this._prices.get(feed);
  }

  getAllPrices(): ReadonlyArray<OracleLatestPrice> {
    return Array.from(this._prices.values());
  }

  get isComplete(): boolean {
    return this._requiredFeeds.every((feed) => this._prices.has(feed));
  }

  get missingFeeds(): string[] {
    return this._requiredFeeds.filter((feed) => !this._prices.has(feed));
  }

  // ─── Commands ────────────────────────────────────────────────────────────────

  recordPrice(price: OracleLatestPrice): void {
    if (!this._requiredFeeds.includes(price.feed)) {
      throw new Error(`Feed ${price.feed} is not in required feeds for this snapshot`);
    }

    const previous = this._prices.get(price.feed);
    this._prices.set(price.feed, price);
    this.incrementVersion();

    if (previous) {
      this.addDomainEvent(
        new OracleSnapshotPriceUpdatedEvent(this._id, this.version, {
          feed: price.feed,
          previousPrice: previous.price,
          newPrice: price.price,
        }),
      );
    }
  }

  /**
   * Finalises the snapshot – enforces the invariant that all feeds are present.
   * Emits OracleSnapshotRecordedEvent.
   */
  finalise(): void {
    this.validateInvariants();

    this.addDomainEvent(
      new OracleSnapshotRecordedEvent(this._id, this.version, {
        agentId: this._agentId,
        feeds: [...this._requiredFeeds],
        timestamp: this._timestamp,
      }),
    );
  }

  // ─── Invariants ──────────────────────────────────────────────────────────────

  protected validateInvariants(): void {
    const missing = this.missingFeeds;
    if (missing.length > 0) {
      throw new Error(
        `OracleSnapshot invariant violated: missing required feeds [${missing.join(', ')}]`,
      );
    }

    // No duplicates (handled by Map, but verify requiredFeeds has no dups)
    const uniqueFeeds = new Set(this._requiredFeeds);
    if (uniqueFeeds.size !== this._requiredFeeds.length) {
      throw new Error('OracleSnapshot invariant violated: duplicate feed identifiers in requiredFeeds');
    }
  }

  toState(): OracleSnapshotState {
    return {
      id: this._id,
      agentId: this._agentId,
      requiredFeeds: [...this._requiredFeeds],
      prices: Array.from(this._prices.values()).map((p) => p.toPlain()),
      timestamp: this._timestamp,
      version: this.version,
    };
  }
}
