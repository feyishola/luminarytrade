import { DomainEvent } from '../base/domain-event.base';
import { AuditAction } from './audit-entry.entity';

export class AuditLogCreatedEvent extends DomainEvent {
  readonly eventType = 'audit.log_created';

  constructor(
    aggregateId: string,
    aggregateVersion: number,
    readonly payload: { entityId: string; entityType: string },
  ) {
    super(aggregateId, 'AuditLog', aggregateVersion);
  }
}

export class AuditEntryAddedEvent extends DomainEvent {
  readonly eventType = 'audit.entry_added';

  constructor(
    aggregateId: string,
    aggregateVersion: number,
    readonly payload: {
      entryId: string;
      action: AuditAction;
      actorId: string;
      timestamp: Date;
    },
  ) {
    super(aggregateId, 'AuditLog', aggregateVersion);
  }
}
