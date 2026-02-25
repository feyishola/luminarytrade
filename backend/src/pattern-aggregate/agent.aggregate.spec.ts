import { Agent, AgentStatus } from '../../aggregate/domain/agent/agent.aggregate';
import { AgentScore } from '../../aggregate/domain/agent/agent-score.value-object';
import {
  AgentCreatedEvent,
  AgentScoreUpdatedEvent,
  AgentDeactivatedEvent,
} from '../../aggregate/domain/agent/agent-events';

describe('Agent Aggregate', () => {
  const validScore = AgentScore.create(80, 90, 70);
  const agentId = 'agent-001';

  const baseProps = {
    name: 'Test Agent',
    owner: 'owner-abc',
    type: 'oracle',
    score: validScore,
  };

  // ─── Factory Tests ─────────────────────────────────────────────────────────

  describe('Agent.create()', () => {
    it('creates an agent with default ACTIVE status', () => {
      const agent = Agent.create(agentId, baseProps);
      expect(agent.id).toBe(agentId);
      expect(agent.status).toBe(AgentStatus.ACTIVE);
      expect(agent.version).toBe(0);
      expect(agent.isActive).toBe(true);
    });

    it('emits AgentCreatedEvent on creation', () => {
      const agent = Agent.create(agentId, baseProps);
      const events = agent.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AgentCreatedEvent);
      expect(events[0].aggregateId).toBe(agentId);
    });

    it('stores score correctly', () => {
      const agent = Agent.create(agentId, baseProps);
      expect(agent.score.accuracy).toBe(80);
      expect(agent.score.reliability).toBe(90);
      expect(agent.score.performance).toBe(70);
    });
  });

  // ─── Invariant Tests ───────────────────────────────────────────────────────

  describe('Agent Invariants', () => {
    it('throws when owner is empty string', () => {
      expect(() =>
        Agent.create(agentId, { ...baseProps, owner: '' }),
      ).toThrow('owner must not be null or empty');
    });

    it('throws when owner is only whitespace', () => {
      expect(() =>
        Agent.create(agentId, { ...baseProps, owner: '   ' }),
      ).toThrow('owner must not be null or empty');
    });

    it('throws when name is empty', () => {
      expect(() =>
        Agent.create(agentId, { ...baseProps, name: '' }),
      ).toThrow('name must not be empty');
    });

    it('throws when score accuracy is out of range', () => {
      expect(() => AgentScore.create(101, 50, 50)).toThrow(
        'accuracy must be between 0 and 100',
      );
    });

    it('throws when score has negative value', () => {
      expect(() => AgentScore.create(-1, 50, 50)).toThrow(
        'accuracy must be between 0 and 100',
      );
    });
  });

  // ─── Command Tests ─────────────────────────────────────────────────────────

  describe('updateScore()', () => {
    it('updates score on active agent', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.clearDomainEvents();

      const newScore = AgentScore.create(95, 88, 92);
      agent.updateScore(newScore);

      expect(agent.score.accuracy).toBe(95);
      expect(agent.version).toBe(1);
    });

    it('emits AgentScoreUpdatedEvent', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.clearDomainEvents();

      const newScore = AgentScore.create(95, 88, 92);
      agent.updateScore(newScore);

      const events = agent.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AgentScoreUpdatedEvent);

      const evt = events[0] as AgentScoreUpdatedEvent;
      expect(evt.payload.previousScore.accuracy).toBe(80);
      expect(evt.payload.newScore.accuracy).toBe(95);
    });

    it('throws when updating score on INACTIVE agent', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.deactivate('test');
      agent.clearDomainEvents();

      expect(() => agent.updateScore(AgentScore.create(50, 50, 50))).toThrow(
        'Cannot update score on INACTIVE agent',
      );
    });

    it('throws when updating score on SUSPENDED agent', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.suspend();
      agent.clearDomainEvents();

      expect(() => agent.updateScore(AgentScore.create(50, 50, 50))).toThrow(
        'Cannot update score on SUSPENDED agent',
      );
    });
  });

  describe('deactivate()', () => {
    it('deactivates an active agent', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.deactivate('no longer needed');
      expect(agent.status).toBe(AgentStatus.INACTIVE);
      expect(agent.isActive).toBe(false);
    });

    it('emits AgentDeactivatedEvent', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.clearDomainEvents();

      agent.deactivate('no longer needed');

      const events = agent.domainEvents;
      expect(events[0]).toBeInstanceOf(AgentDeactivatedEvent);
      expect((events[0] as AgentDeactivatedEvent).payload.reason).toBe('no longer needed');
    });

    it('throws when already inactive', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.deactivate('first reason');

      expect(() => agent.deactivate('second reason')).toThrow('already inactive');
    });
  });

  describe('suspend()', () => {
    it('suspends an active agent', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.suspend();
      expect(agent.status).toBe(AgentStatus.SUSPENDED);
    });

    it('throws when suspending inactive agent', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.deactivate('reason');
      expect(() => agent.suspend()).toThrow('Only active agents can be suspended');
    });
  });

  // ─── Versioning Tests ──────────────────────────────────────────────────────

  describe('Versioning', () => {
    it('starts at version 0', () => {
      const agent = Agent.create(agentId, baseProps);
      expect(agent.version).toBe(0);
    });

    it('increments version on each mutation', () => {
      const agent = Agent.create(agentId, baseProps);
      agent.updateScore(AgentScore.create(1, 1, 1));
      expect(agent.version).toBe(1);

      agent.updateMetadata({ key: 'value' });
      expect(agent.version).toBe(2);
    });
  });

  // ─── Reconstitution Tests ──────────────────────────────────────────────────

  describe('Agent.reconstitute()', () => {
    it('reconstitutes from state correctly', () => {
      const original = Agent.create(agentId, baseProps);
      const state = original.toState();
      const reconstituted = Agent.reconstitute(state);

      expect(reconstituted.id).toBe(original.id);
      expect(reconstituted.score.accuracy).toBe(original.score.accuracy);
      expect(reconstituted.status).toBe(original.status);
      expect(reconstituted.version).toBe(original.version);
    });

    it('reconstituted agent has no pending events', () => {
      const original = Agent.create(agentId, baseProps);
      const state = original.toState();
      const reconstituted = Agent.reconstitute(state);
      expect(reconstituted.domainEvents).toHaveLength(0);
    });
  });
});
