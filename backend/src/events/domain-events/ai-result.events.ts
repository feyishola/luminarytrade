import { DomainEvent } from './domain-event.base';

export class AIResultCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      userId: string;
      provider: string;
      request: Record<string, any>;
    },
    version: number = 1,
    metadata: Record<string, any> = {},
    correlationId?: string,
    causationId?: string,
  ) {
    super(
      aggregateId,
      'AIResult',
      'AIResultCreated',
      payload,
      version,
      metadata,
      correlationId,
      causationId,
    );
  }
}

export class AIResultCompletedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      userId: string;
      provider: string;
      creditScore: number;
      riskScore: number;
      riskLevel: string;
      signature: string;
      completedAt: Date;
    },
    version: number = 1,
    metadata: Record<string, any> = {},
    correlationId?: string,
    causationId?: string,
  ) {
    super(
      aggregateId,
      'AIResult',
      'AIResultCompleted',
      payload,
      version,
      metadata,
      correlationId,
      causationId,
    );
  }
}

export class AIResultFailedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      userId: string;
      provider: string;
      errorMessage: string;
      failedAt: Date;
    },
    version: number = 1,
    metadata: Record<string, any> = {},
    correlationId?: string,
    causationId?: string,
  ) {
    super(
      aggregateId,
      'AIResult',
      'AIResultFailed',
      payload,
      version,
      metadata,
      correlationId,
      causationId,
    );
  }
}
