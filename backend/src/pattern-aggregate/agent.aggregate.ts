import { AggregateRoot } from '../base/aggregate-root.base';
import { AgentScore } from './agent-score.value-object';
import {
  AgentCreatedEvent,
  AgentDeactivatedEvent,
  AgentScoreUpdatedEvent,
} from './agent-events';

export enum AgentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface AgentProps {
  name: string;
  owner: string;
  type: string;
  score: AgentScore;
  status: AgentStatus;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AgentState {
  id: string;
  name: string;
  owner: string;
  type: string;
  score: { accuracy: number; reliability: number; performance: number };
  status: AgentStatus;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent Aggregate Root
 *
 * Invariants:
 *  1. owner must not be null/empty
 *  2. score values must be between 0–100
 *  3. name must not be empty
 *  4. Cannot update score on inactive/suspended agent
 */
export class Agent extends AggregateRoot<string> {
  private _name: string;
  private _owner: string;
  private _type: string;
  private _score: AgentScore;
  private _status: AgentStatus;
  private _metadata: Record<string, unknown>;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(id: string, props: AgentProps, version: number) {
    super(id, version);
    this._name = props.name;
    this._owner = props.owner;
    this._type = props.type;
    this._score = props.score;
    this._status = props.status;
    this._metadata = props.metadata ?? {};
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  // ─── Factory ────────────────────────────────────────────────────────────────

  static create(id: string, props: Omit<AgentProps, 'status' | 'createdAt' | 'updatedAt'>): Agent {
    const agent = new Agent(
      id,
      {
        ...props,
        status: AgentStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      0,
    );

    agent.validateInvariants();

    agent.addDomainEvent(
      new AgentCreatedEvent(id, agent.version, {
        name: props.name,
        owner: props.owner,
        type: props.type,
        score: props.score.toPlain(),
      }),
    );

    return agent;
  }

  static reconstitute(state: AgentState): Agent {
    return new Agent(
      state.id,
      {
        name: state.name,
        owner: state.owner,
        type: state.type,
        score: AgentScore.create(state.score.accuracy, state.score.reliability, state.score.performance),
        status: state.status,
        metadata: state.metadata,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      },
      state.version,
    );
  }

  // ─── Accessors ───────────────────────────────────────────────────────────────

  get name(): string { return this._name; }
  get owner(): string { return this._owner; }
  get type(): string { return this._type; }
  get score(): AgentScore { return this._score; }
  get status(): AgentStatus { return this._status; }
  get metadata(): Record<string, unknown> { return { ...this._metadata }; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get isActive(): boolean { return this._status === AgentStatus.ACTIVE; }

  // ─── Commands ────────────────────────────────────────────────────────────────

  updateScore(newScore: AgentScore): void {
    if (!this.isActive) {
      throw new Error(`Cannot update score on ${this._status} agent`);
    }

    const previousScore = this._score;
    this._score = newScore;
    this._updatedAt = new Date();
    this.incrementVersion();

    this.validateInvariants();

    this.addDomainEvent(
      new AgentScoreUpdatedEvent(this._id, this.version, {
        previousScore: previousScore.toPlain(),
        newScore: newScore.toPlain(),
      }),
    );
  }

  deactivate(reason: string): void {
    if (this._status === AgentStatus.INACTIVE) {
      throw new Error('Agent is already inactive');
    }

    this._status = AgentStatus.INACTIVE;
    this._updatedAt = new Date();
    this.incrementVersion();

    this.addDomainEvent(
      new AgentDeactivatedEvent(this._id, this.version, { reason }),
    );
  }

  suspend(): void {
    if (this._status !== AgentStatus.ACTIVE) {
      throw new Error('Only active agents can be suspended');
    }
    this._status = AgentStatus.SUSPENDED;
    this._updatedAt = new Date();
    this.incrementVersion();
  }

  updateMetadata(metadata: Record<string, unknown>): void {
    this._metadata = { ...this._metadata, ...metadata };
    this._updatedAt = new Date();
    this.incrementVersion();
  }

  // ─── Invariants ──────────────────────────────────────────────────────────────

  protected validateInvariants(): void {
    if (!this._owner || this._owner.trim() === '') {
      throw new Error('Agent invariant violated: owner must not be null or empty');
    }
    if (!this._name || this._name.trim() === '') {
      throw new Error('Agent invariant violated: name must not be empty');
    }
    if (!this._score) {
      throw new Error('Agent invariant violated: score must not be null');
    }
  }

  toState(): AgentState {
    return {
      id: this._id,
      name: this._name,
      owner: this._owner,
      type: this._type,
      score: this._score.toPlain(),
      status: this._status,
      metadata: this._metadata,
      version: this.version,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
