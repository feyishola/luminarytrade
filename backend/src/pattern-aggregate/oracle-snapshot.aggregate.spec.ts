import { OracleSnapshot } from '../../aggregate/domain/oracle/oracle-snapshot.aggregate';
import { OracleLatestPrice } from '../../aggregate/domain/oracle/oracle-latest-price.entity';
import {
  OracleSnapshotRecordedEvent,
  OracleSnapshotPriceUpdatedEvent,
} from '../../aggregate/domain/oracle/oracle-events';

describe('OracleSnapshot Aggregate', () => {
  const snapshotId = 'snapshot-001';
  const agentId = 'agent-001';
  const requiredFeeds = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
  const now = new Date();

  const makePrice = (feed: string, price: number) =>
    OracleLatestPrice.create(feed, price, 0.99, -8, now);

  const makeCompleteSnapshot = () => {
    const snapshot = OracleSnapshot.create(snapshotId, { agentId, requiredFeeds });
    for (const feed of requiredFeeds) {
      snapshot.recordPrice(makePrice(feed, 50000));
    }
    return snapshot;
  };

  // ─── Factory Tests ─────────────────────────────────────────────────────────

  describe('OracleSnapshot.create()', () => {
    it('creates snapshot with required feeds', () => {
      const snapshot = OracleSnapshot.create(snapshotId, { agentId, requiredFeeds });
      expect(snapshot.id).toBe(snapshotId);
      expect(snapshot.agentId).toBe(agentId);
      expect(snapshot.requiredFeeds).toEqual(requiredFeeds);
      expect(snapshot.isComplete).toBe(false);
    });

    it('throws without agentId', () => {
      expect(() =>
        OracleSnapshot.create(snapshotId, { agentId: '', requiredFeeds }),
      ).toThrow('agentId is required');
    });

    it('throws with empty requiredFeeds', () => {
      expect(() =>
        OracleSnapshot.create(snapshotId, { agentId, requiredFeeds: [] }),
      ).toThrow('requiredFeeds must not be empty');
    });
  });

  // ─── Price Recording Tests ─────────────────────────────────────────────────

  describe('recordPrice()', () => {
    it('records a price for a required feed', () => {
      const snapshot = OracleSnapshot.create(snapshotId, { agentId, requiredFeeds });
      snapshot.recordPrice(makePrice('BTC/USD', 50000));

      const price = snapshot.getPrice('BTC/USD');
      expect(price).toBeDefined();
      expect(price!.price).toBe(50000);
    });

    it('throws when recording price for unknown feed', () => {
      const snapshot = OracleSnapshot.create(snapshotId, { agentId, requiredFeeds });
      expect(() =>
        snapshot.recordPrice(makePrice('XRP/USD', 1)),
      ).toThrow('XRP/USD is not in required feeds');
    });

    it('emits PriceUpdatedEvent when overwriting existing price', () => {
      const snapshot = OracleSnapshot.create(snapshotId, { agentId, requiredFeeds });
      snapshot.recordPrice(makePrice('BTC/USD', 50000));
      snapshot.clearDomainEvents();

      snapshot.recordPrice(makePrice('BTC/USD', 51000));

      const events = snapshot.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OracleSnapshotPriceUpdatedEvent);

      const evt = events[0] as OracleSnapshotPriceUpdatedEvent;
      expect(evt.payload.previousPrice).toBe(50000);
      expect(evt.payload.newPrice).toBe(51000);
    });

    it('tracks missing feeds correctly', () => {
      const snapshot = OracleSnapshot.create(snapshotId, { agentId, requiredFeeds });
      snapshot.recordPrice(makePrice('BTC/USD', 50000));

      expect(snapshot.missingFeeds).toEqual(['ETH/USD', 'SOL/USD']);
      expect(snapshot.isComplete).toBe(false);
    });
  });

  // ─── Invariant Tests ──────────────────────────────────────────────────────

  describe('Invariant: all feeds must be present', () => {
    it('finalise() succeeds when all feeds recorded', () => {
      const snapshot = makeCompleteSnapshot();
      expect(() => snapshot.finalise()).not.toThrow();
    });

    it('finalise() emits OracleSnapshotRecordedEvent', () => {
      const snapshot = makeCompleteSnapshot();
      snapshot.clearDomainEvents();
      snapshot.finalise();

      const events = snapshot.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OracleSnapshotRecordedEvent);

      const evt = events[0] as OracleSnapshotRecordedEvent;
      expect(evt.payload.feeds).toEqual(requiredFeeds);
      expect(evt.payload.agentId).toBe(agentId);
    });

    it('finalise() throws when feeds are missing', () => {
      const snapshot = OracleSnapshot.create(snapshotId, { agentId, requiredFeeds });
      snapshot.recordPrice(makePrice('BTC/USD', 50000));

      expect(() => snapshot.finalise()).toThrow(
        'OracleSnapshot invariant violated: missing required feeds [ETH/USD, SOL/USD]',
      );
    });
  });

  // ─── OracleLatestPrice Entity Tests ───────────────────────────────────────

  describe('OracleLatestPrice', () => {
    it('calculates adjusted price', () => {
      const price = OracleLatestPrice.create('BTC/USD', 5000000, 0.99, -2, now);
      expect(price.adjustedPrice).toBeCloseTo(50000);
    });

    it('throws on negative price', () => {
      expect(() =>
        OracleLatestPrice.create('BTC/USD', -1, 0.99, -8, now),
      ).toThrow('Price for feed BTC/USD must be non-negative');
    });

    it('throws on confidence out of range', () => {
      expect(() =>
        OracleLatestPrice.create('BTC/USD', 100, 1.5, -8, now),
      ).toThrow('Confidence for feed BTC/USD must be between 0 and 1');
    });
  });

  // ─── Reconstitution Tests ──────────────────────────────────────────────────

  describe('reconstitute()', () => {
    it('reconstitutes with all prices intact', () => {
      const original = makeCompleteSnapshot();
      const state = original.toState();
      const reconstituted = OracleSnapshot.reconstitute(state);

      expect(reconstituted.isComplete).toBe(true);
      expect(reconstituted.getAllPrices()).toHaveLength(3);
      expect(reconstituted.getPrice('BTC/USD')).toBeDefined();
    });
  });
});
