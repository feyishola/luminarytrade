/**
 * Invariant tests: exhaustive boundary-case testing for all aggregate invariants.
 */
import { Agent } from '../../aggregate/domain/agent/agent.aggregate';
import { AgentScore } from '../../aggregate/domain/agent/agent-score.value-object';
import { OracleSnapshot } from '../../aggregate/domain/oracle/oracle-snapshot.aggregate';
import { OracleLatestPrice } from '../../aggregate/domain/oracle/oracle-latest-price.entity';
import { AuditLog } from '../../aggregate/domain/audit/audit-log.aggregate';
import { AuditAction } from '../../aggregate/domain/audit/audit-entry.entity';

describe('Aggregate Invariant Enforcement', () => {
  // ─── AgentScore Value Object Boundary Tests ────────────────────────────────

  describe('AgentScore invariants', () => {
    const validCases = [
      [0, 0, 0],
      [100, 100, 100],
      [50, 50, 50],
      [0, 100, 50],
    ];

    test.each(validCases)(
      'accepts valid score (%d, %d, %d)',
      (acc, rel, perf) => {
        expect(() => AgentScore.create(acc, rel, perf)).not.toThrow();
      },
    );

    const invalidCases = [
      [-1, 50, 50, 'accuracy'],
      [101, 50, 50, 'accuracy'],
      [50, -0.1, 50, 'reliability'],
      [50, 100.01, 50, 'reliability'],
      [50, 50, -1, 'performance'],
      [50, 50, 101, 'performance'],
    ];

    test.each(invalidCases)(
      'rejects invalid score (%d, %d, %d) - %s out of range',
      (acc, rel, perf, field) => {
        expect(() => AgentScore.create(acc, rel, perf)).toThrow(field as string);
      },
    );

    it('computes composite score correctly', () => {
      const score = AgentScore.create(60, 90, 75);
      expect(score.composite).toBe(Math.round((60 + 90 + 75) / 3));
    });
  });

  // ─── Agent Aggregate Invariants ────────────────────────────────────────────

  describe('Agent invariants at every mutation boundary', () => {
    const validScore = AgentScore.create(80, 80, 80);

    it('enforces owner not null at creation', () => {
      expect(() =>
        Agent.create('id', { name: 'n', owner: '', type: 't', score: validScore }),
      ).toThrow('owner must not be null or empty');
    });

    it('enforces name not empty at creation', () => {
      expect(() =>
        Agent.create('id', { name: '', owner: 'owner', type: 't', score: validScore }),
      ).toThrow('name must not be empty');
    });

    it('preserves invariant after successful mutation', () => {
      const agent = Agent.create('id', { name: 'n', owner: 'owner', type: 't', score: validScore });
      // After mutation the agent should still satisfy invariants silently
      expect(() => agent.updateScore(AgentScore.create(10, 10, 10))).not.toThrow();
    });

    it('does NOT allow score update to leave agent in invalid state', () => {
      const agent = Agent.create('id', { name: 'n', owner: 'owner', type: 't', score: validScore });
      agent.deactivate('reason');
      expect(() => agent.updateScore(validScore)).toThrow('Cannot update score on INACTIVE agent');
    });
  });

  // ─── OracleSnapshot Invariants ────────────────────────────────────────────

  describe('OracleSnapshot: all feeds present invariant', () => {
    const now = new Date();
    const feeds = ['BTC/USD', 'ETH/USD'];

    it('isComplete returns false with partial feeds', () => {
      const snap = OracleSnapshot.create('s1', { agentId: 'a1', requiredFeeds: feeds });
      snap.recordPrice(OracleLatestPrice.create('BTC/USD', 50000, 0.99, -8, now));
      expect(snap.isComplete).toBe(false);
      expect(snap.missingFeeds).toEqual(['ETH/USD']);
    });

    it('isComplete returns true when all feeds recorded', () => {
      const snap = OracleSnapshot.create('s1', { agentId: 'a1', requiredFeeds: feeds });
      snap.recordPrice(OracleLatestPrice.create('BTC/USD', 50000, 0.99, -8, now));
      snap.recordPrice(OracleLatestPrice.create('ETH/USD', 3000, 0.98, -8, now));
      expect(snap.isComplete).toBe(true);
    });

    it('finalise() throws with missing feeds providing list of missing', () => {
      const snap = OracleSnapshot.create('s1', {
        agentId: 'a1',
        requiredFeeds: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
      });
      snap.recordPrice(OracleLatestPrice.create('BTC/USD', 50000, 0.99, -8, now));

      try {
        snap.finalise();
        fail('should have thrown');
      } catch (err: unknown) {
        const message = (err as Error).message;
        expect(message).toContain('ETH/USD');
        expect(message).toContain('SOL/USD');
        expect(message).not.toContain('BTC/USD');
      }
    });

    it('rejects unknown feeds at recordPrice boundary', () => {
      const snap = OracleSnapshot.create('s1', { agentId: 'a1', requiredFeeds: feeds });
      expect(() =>
        snap.recordPrice(OracleLatestPrice.create('DOGE/USD', 0.1, 0.9, -8, now)),
      ).toThrow('not in required feeds');
    });
  });

  // ─── AuditLog Chronological Invariant ────────────────────────────────────

  describe('AuditLog: strict chronological order invariant', () => {
    const entry = (offset: number) => ({
      action: AuditAction.UPDATE,
      actorId: 'actor',
      timestamp: new Date(Date.now() + offset * 1000),
    });

    it('accepts monotonically increasing timestamps', () => {
      const log = AuditLog.create('l1', { entityId: 'e1', entityType: 'E' });
      expect(() => {
        log.addEntry(entry(10));
        log.addEntry(entry(20));
        log.addEntry(entry(30));
      }).not.toThrow();
    });

    it('rejects equal timestamp', () => {
      const log = AuditLog.create('l1', { entityId: 'e1', entityType: 'E' });
      const ts = new Date('2024-06-01T00:00:00.000Z');
      log.addEntry({ ...entry(0), timestamp: ts });
      expect(() =>
        log.addEntry({ ...entry(0), timestamp: ts }),
      ).toThrow('AuditLog invariant violated');
    });

    it('rejects earlier timestamp', () => {
      const log = AuditLog.create('l1', { entityId: 'e1', entityType: 'E' });
      log.addEntry(entry(100));
      expect(() => log.addEntry(entry(50))).toThrow('AuditLog invariant violated');
    });

    it('entry count remains unchanged after violation', () => {
      const log = AuditLog.create('l1', { entityId: 'e1', entityType: 'E' });
      log.addEntry(entry(100));
      try { log.addEntry(entry(50)); } catch { /* expected */ }
      expect(log.entryCount).toBe(1);
    });
  });
});
