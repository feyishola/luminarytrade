export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
}

export interface AuditEntryProps {
  action: AuditAction;
  actorId: string;
  targetId?: string;
  targetType?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * AuditEntry - Child entity of AuditLog aggregate.
 * Must ONLY be accessed/mutated through AuditLog aggregate root.
 */
export class AuditEntry {
  private constructor(
    private readonly _entryId: string,
    private readonly _action: AuditAction,
    private readonly _actorId: string,
    private readonly _timestamp: Date,
    private readonly _targetId?: string,
    private readonly _targetType?: string,
    private readonly _changes?: Record<string, { before: unknown; after: unknown }>,
    private readonly _metadata?: Record<string, unknown>,
  ) {}

  static create(entryId: string, props: AuditEntryProps): AuditEntry {
    if (!props.actorId) throw new Error('AuditEntry: actorId is required');
    return new AuditEntry(
      entryId,
      props.action,
      props.actorId,
      props.timestamp,
      props.targetId,
      props.targetType,
      props.changes,
      props.metadata,
    );
  }

  static reconstitute(data: ReturnType<AuditEntry['toPlain']>): AuditEntry {
    return new AuditEntry(
      data.entryId,
      data.action as AuditAction,
      data.actorId,
      new Date(data.timestamp),
      data.targetId,
      data.targetType,
      data.changes,
      data.metadata,
    );
  }

  get entryId(): string { return this._entryId; }
  get action(): AuditAction { return this._action; }
  get actorId(): string { return this._actorId; }
  get timestamp(): Date { return this._timestamp; }
  get targetId(): string | undefined { return this._targetId; }
  get targetType(): string | undefined { return this._targetType; }
  get changes(): Record<string, { before: unknown; after: unknown }> | undefined { return this._changes; }
  get metadata(): Record<string, unknown> | undefined { return this._metadata; }

  toPlain() {
    return {
      entryId: this._entryId,
      action: this._action,
      actorId: this._actorId,
      timestamp: this._timestamp.toISOString(),
      targetId: this._targetId,
      targetType: this._targetType,
      changes: this._changes,
      metadata: this._metadata,
    };
  }
}
