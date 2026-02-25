import { DomainEvent } from '../base/domain-event.base';
import { AgentScore } from './agent-score.value-object';

export class AgentCreatedEvent extends DomainEvent {
  readonly eventType = 'agent.created';

  constructor(
    aggregateId: string,
    aggregateVersion: number,
    readonly payload: {
      name: string;
      owner: string;
      type: string;
      score: ReturnType<AgentScore['toPlain']>;
    },
  ) {
    super(aggregateId, 'Agent', aggregateVersion);
  }
}

export class AgentScoreUpdatedEvent extends DomainEvent {
  readonly eventType = 'agent.score_updated';

  constructor(
    aggregateId: string,
    aggregateVersion: number,
    readonly payload: {
      previousScore: ReturnType<AgentScore['toPlain']>;
      newScore: ReturnType<AgentScore['toPlain']>;
    },
  ) {
    super(aggregateId, 'Agent', aggregateVersion);
  }
}

export class AgentDeactivatedEvent extends DomainEvent {
  readonly eventType = 'agent.deactivated';

  constructor(
    aggregateId: string,
    aggregateVersion: number,
    readonly payload: { reason: string },
  ) {
    super(aggregateId, 'Agent', aggregateVersion);
  }
}
