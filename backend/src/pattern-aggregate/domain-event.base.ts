import { v4 as uuid } from 'uuid';

export abstract class DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateVersion: number;

  constructor(
    readonly aggregateId: string,
    readonly aggregateType: string,
    aggregateVersion: number,
  ) {
    this.eventId = uuid();
    this.occurredAt = new Date();
    this.aggregateVersion = aggregateVersion;
  }

  abstract get eventType(): string;
}
