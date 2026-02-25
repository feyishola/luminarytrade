import { v4 as uuid } from 'uuid';
import { AggregateRoot } from '../base/aggregate-root.base';
import { AuditEntry, AuditAction, AuditEntryProps } from './audit-entry.entity';
import { AuditLogCreatedEvent, AuditEntryAddedEvent } from './audit-events';

export interface AuditLogProps {
  entityId: string;
  entityType: string;
  entries?: AuditEntry[];
  createdAt?: Date;
}

export interface AuditLogState {
  id: string;
  entityId: string;
  entityType: string;
  entries: ReturnType<AuditEntry['toPlain']>[];
  version: number;
  createdAt: Date;
}

/**
 * AuditLog Aggregate Root
 *
 * Invariants:
 *  1. Entries must be in strictly chronological order
 *  2. New entries cannot precede the last entry timestamp
 *  3. entityId and entityType must not be empty
 */
export class AuditLog extends AggregateRoot<string> {
  private _entityId: string;
  private _entityType: string;
  private _entries: AuditEntry[];
  private _createdAt: Date;

  private constructor(id: string, props: AuditLogProps, version: number) {
    super(id, version);
    this._entityId = props.entityId;
    this._entityType = props.entityType;
    this._entries = props.entries ? [...props.entries] : [];
    this._createdAt = props.createdAt ?? new Date();
  }

  // ─── Factory ─────────────────────────────────────────────────────────────────

  static create(id: string, props: Omit<AuditLogProps, 'entries' | 'createdAt'>): AuditLog {
    if (!props.entityId) throw new Error('AuditLog: entityId is required');
    if (!props.entityType) throw new Error('AuditLog: entityType is required');

    const log = new AuditLog(id, { ...props, createdAt: new Date() }, 0);

    log.addDomainEvent(
      new AuditLogCreatedEvent(id, log.version, {
        entityId: props.entityId,
        entityType: props.entityType,
      }),
    );

    return log;
  }

  static reconstitute(state: AuditLogState): AuditLog {
    const entries = state.entries.map((e) => AuditEntry.reconstitute(e));
    return new AuditLog(
      state.id,
      {
        entityId: state.entityId,
        entityType: state.entityType,
        entries,
        createdAt: state.createdAt,
      },
      state.version,
    );
  }

  // ─── Accessors ───────────────────────────────────────────────────────────────

  get entityId(): string { return this._entityId; }
  get entityType(): string { return this._entityType; }
  get createdAt(): Date { return this._createdAt; }
  get entryCount(): number { return this._entries.length; }

  /** Only accessible through aggregate root */
  getEntries(): ReadonlyArray<AuditEntry> {
    return [...this._entries];
  }

  getEntriesByActor(actorId: string): ReadonlyArray<AuditEntry> {
    return this._entries.filter((e) => e.actorId === actorId);
  }

  getEntriesByAction(action: AuditAction): ReadonlyArray<AuditEntry> {
    return this._entries.filter((e) => e.action === action);
  }

  getLastEntry(): AuditEntry | undefined {
    return this._entries[this._entries.length - 1];
  }

  // ─── Commands ────────────────────────────────────────────────────────────────

  addEntry(props: AuditEntryProps): AuditEntry {
    const lastEntry = this.getLastEntry();

    // Enforce chronological invariant
    if (lastEntry && props.timestamp <= lastEntry.timestamp) {
      throw new Error(
        `AuditLog invariant violated: new entry timestamp (${props.timestamp.toISOString()}) ` +
        `must be after last entry timestamp (${lastEntry.timestamp.toISOString()})`,
      );
    }

    const entryId = uuid();
    const entry = AuditEntry.create(entryId, props);

    this._entries.push(entry);
    this.incrementVersion();

    this.addDomainEvent(
      new AuditEntryAddedEvent(this._id, this.version, {
        entryId,
        action: props.action,
        actorId: props.actorId,
        timestamp: props.timestamp,
      }),
    );

    return entry;
  }

  // ─── Invariants ──────────────────────────────────────────────────────────────

  protected validateInvariants(): void {
    if (!this._entityId || this._entityId.trim() === '') {
      throw new Error('AuditLog invariant violated: entityId must not be empty');
    }
    if (!this._entityType || this._entityType.trim() === '') {
      throw new Error('AuditLog invariant violated: entityType must not be empty');
    }

    // Verify chronological ordering
    for (let i = 1; i < this._entries.length; i++) {
      if (this._entries[i].timestamp <= this._entries[i - 1].timestamp) {
        throw new Error(
          `AuditLog invariant violated: entries are not in chronological order at index ${i}`,
        );
      }
    }
  }

  toState(): AuditLogState {
    return {
      id: this._id,
      entityId: this._entityId,
      entityType: this._entityType,
      entries: this._entries.map((e) => e.toPlain()),
      version: this.version,
      createdAt: this._createdAt,
    };
  }
}
