import { v4 as uuidv4 } from 'uuid';

export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly eventType: string;
  public readonly payload: Record<string, any>;
  public readonly metadata: Record<string, any>;
  public readonly version: number;
  public readonly timestamp: Date;
  public readonly correlationId?: string;
  public readonly causationId?: string;

  constructor(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    payload: Record<string, any>,
    version: number,
    metadata: Record<string, any> = {},
    correlationId?: string,
    causationId?: string,
  ) {
    this.eventId = uuidv4();
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.eventType = eventType;
    this.payload = payload;
    this.metadata = metadata;
    this.version = version;
    this.timestamp = new Date();
    this.correlationId = correlationId;
    this.causationId = causationId;
  }

  static fromEventStore(eventData: any): DomainEvent {
    return new (class extends DomainEvent {
      constructor() {
        super(
          eventData.aggregateId,
          eventData.aggregateType,
          eventData.eventType,
          eventData.payload,
          eventData.version,
          eventData.metadata,
          eventData.correlationId,
          eventData.causationId,
        );
      }
    })();
  }

  withCorrelation(correlationId: string): DomainEvent {
    return new (this.constructor as any)(
      this.aggregateId,
      this.aggregateType,
      this.eventType,
      this.payload,
      this.version,
      this.metadata,
      correlationId,
      this.causationId,
    );
  }

  withCausation(causationId: string): DomainEvent {
    return new (this.constructor as any)(
      this.aggregateId,
      this.aggregateType,
      this.eventType,
      this.payload,
      this.version,
      this.metadata,
      this.correlationId,
      causationId,
    );
  }
}
