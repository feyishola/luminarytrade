import { DomainEvent } from './domain-event.base';

export abstract class AggregateRoot<TId = string> {
  private _domainEvents: DomainEvent[] = [];
  private _version: number = 0;

  protected constructor(
    protected readonly _id: TId,
    version: number = 0,
  ) {
    this._version = version;
  }

  get id(): TId {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  incrementVersion(): void {
    this._version += 1;
  }

  protected abstract validateInvariants(): void;
}
