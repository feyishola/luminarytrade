import { AuditLog } from '../../aggregate/domain/audit/audit-log.aggregate';
import { AuditAction } from '../../aggregate/domain/audit/audit-entry.entity';
import {
  AuditLogCreatedEvent,
  AuditEntryAddedEvent,
} from '../../aggregate/domain/audit/audit-events';

describe('AuditLog Aggregate', () => {
  const logId = 'log-001';
  const entityId = 'agent-001';
  const entityType = 'Agent';

  const baseProps = { entityId, entityType };

  const makeEntry = (daysOffset: number = 0) => ({
    action: AuditAction.UPDATE,
    actorId: 'user-001',
    targetId: entityId,
    targetType: entityType,
    timestamp: new Date(Date.now() + daysOffset * 86_400_000),
  });

  // ─── Factory Tests ─────────────────────────────────────────────────────────

  describe('AuditLog.create()', () => {
    it('creates an empty audit log', () => {
      const log = AuditLog.create(logId, baseProps);
      expect(log.id).toBe(logId);
      expect(log.entityId).toBe(entityId);
      expect(log.entityType).toBe(entityType);
      expect(log.entryCount).toBe(0);
    });

    it('emits AuditLogCreatedEvent', () => {
      const log = AuditLog.create(logId, baseProps);
      const events = log.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AuditLogCreatedEvent);
    });

    it('throws without entityId', () => {
      expect(() =>
        AuditLog.create(logId, { entityId: '', entityType }),
      ).toThrow('entityId is required');
    });

    it('throws without entityType', () => {
      expect(() =>
        AuditLog.create(logId, { entityId, entityType: '' }),
      ).toThrow('entityType is required');
    });
  });

  // ─── Entry Tests ───────────────────────────────────────────────────────────

  describe('addEntry()', () => {
    it('adds an entry and returns it', () => {
      const log = AuditLog.create(logId, baseProps);
      const entry = log.addEntry(makeEntry(1));

      expect(log.entryCount).toBe(1);
      expect(entry.action).toBe(AuditAction.UPDATE);
      expect(entry.actorId).toBe('user-001');
    });

    it('emits AuditEntryAddedEvent', () => {
      const log = AuditLog.create(logId, baseProps);
      log.clearDomainEvents();

      log.addEntry(makeEntry(1));

      const events = log.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AuditEntryAddedEvent);
    });

    it('increments version on each addEntry', () => {
      const log = AuditLog.create(logId, baseProps);
      log.addEntry(makeEntry(1));
      expect(log.version).toBe(1);
      log.addEntry(makeEntry(2));
      expect(log.version).toBe(2);
    });
  });

  // ─── Invariant: Chronological Order ───────────────────────────────────────

  describe('Invariant: chronological order', () => {
    it('allows entries in ascending order', () => {
      const log = AuditLog.create(logId, baseProps);
      expect(() => {
        log.addEntry(makeEntry(1));
        log.addEntry(makeEntry(2));
        log.addEntry(makeEntry(3));
      }).not.toThrow();
      expect(log.entryCount).toBe(3);
    });

    it('throws when entry timestamp is earlier than last entry', () => {
      const log = AuditLog.create(logId, baseProps);
      log.addEntry(makeEntry(5));

      expect(() => log.addEntry(makeEntry(3))).toThrow(
        'AuditLog invariant violated: new entry timestamp',
      );
    });

    it('throws when entry timestamp equals last entry', () => {
      const timestamp = new Date('2024-01-01T10:00:00Z');
      const log = AuditLog.create(logId, baseProps);

      log.addEntry({ ...makeEntry(0), timestamp });
      expect(() =>
        log.addEntry({ ...makeEntry(0), timestamp }),
      ).toThrow('AuditLog invariant violated');
    });

    it('does not roll back entry list on violation', () => {
      const log = AuditLog.create(logId, baseProps);
      log.addEntry(makeEntry(5));

      try {
        log.addEntry(makeEntry(3));
      } catch {
        // expected
      }

      // Prior entries unaffected
      expect(log.entryCount).toBe(1);
    });
  });

  // ─── Query Methods ─────────────────────────────────────────────────────────

  describe('Query methods through aggregate root', () => {
    it('returns entries by actor', () => {
      const log = AuditLog.create(logId, baseProps);
      log.addEntry({ ...makeEntry(1), actorId: 'user-A' });
      log.addEntry({ ...makeEntry(2), actorId: 'user-B' });
      log.addEntry({ ...makeEntry(3), actorId: 'user-A' });

      const byA = log.getEntriesByActor('user-A');
      expect(byA).toHaveLength(2);
    });

    it('returns entries by action', () => {
      const log = AuditLog.create(logId, baseProps);
      log.addEntry({ ...makeEntry(1), action: AuditAction.CREATE });
      log.addEntry({ ...makeEntry(2), action: AuditAction.UPDATE });
      log.addEntry({ ...makeEntry(3), action: AuditAction.DELETE });

      const updates = log.getEntriesByAction(AuditAction.UPDATE);
      expect(updates).toHaveLength(1);
    });

    it('returns last entry', () => {
      const log = AuditLog.create(logId, baseProps);
      log.addEntry(makeEntry(1));
      const last = log.addEntry(makeEntry(2));

      expect(log.getLastEntry()).toBe(last);
    });
  });

  // ─── Reconstitution Tests ──────────────────────────────────────────────────

  describe('reconstitute()', () => {
    it('reconstitutes with all entries', () => {
      const original = AuditLog.create(logId, baseProps);
      original.addEntry(makeEntry(1));
      original.addEntry(makeEntry(2));

      const state = original.toState();
      const reconstituted = AuditLog.reconstitute(state);

      expect(reconstituted.entryCount).toBe(2);
      expect(reconstituted.version).toBe(2);
      expect(reconstituted.domainEvents).toHaveLength(0);
    });
  });
});
