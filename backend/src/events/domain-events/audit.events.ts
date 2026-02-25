import { DomainEvent } from './domain-event.base';

export class AuditLogCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      wallet: string;
      eventType: string;
      metadata: Record<string, any>;
      description?: string;
      relatedEntityId?: string;
      relatedEntityType?: string;
    },
    version: number = 1,
    metadata: Record<string, any> = {},
    correlationId?: string,
    causationId?: string,
  ) {
    super(
      aggregateId,
      'AuditLog',
      'AuditLogCreated',
      payload,
      version,
      metadata,
      correlationId,
      causationId,
    );
  }
}

export class UserAuthenticatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      userId: string;
      wallet: string;
      timestamp: Date;
      ipAddress?: string;
      userAgent?: string;
    },
    version: number = 1,
    metadata: Record<string, any> = {},
    correlationId?: string,
    causationId?: string,
  ) {
    super(
      aggregateId,
      'User',
      'UserAuthenticated',
      payload,
      version,
      metadata,
      correlationId,
      causationId,
    );
  }
}
