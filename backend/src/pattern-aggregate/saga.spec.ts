import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentCreatedEvent, AgentScoreUpdatedEvent } from '../../aggregate/domain/agent/agent-events';
import { AgentAuditSaga } from '../../aggregate/application/sagas/agent-audit.saga';
import { CreateAuditLogHandler, AddAuditEntryHandler } from '../../aggregate/application/handlers/audit-log.handlers';
import { AuditLog } from '../../aggregate/domain/audit/audit-log.aggregate';
import { AuditAction } from '../../aggregate/domain/audit/audit-entry.entity';

const mockCreateAuditLogHandler = {
  execute: jest.fn(),
};

const mockAddAuditEntryHandler = {
  execute: jest.fn(),
};

const mockAuditLogRepository = {
  findById: jest.fn(),
  findByEntityId: jest.fn(),
  save: jest.fn(),
};

describe('AgentAuditSaga (cross-aggregate)', () => {
  let saga: AgentAuditSaga;

  beforeEach(() => {
    jest.clearAllMocks();
    saga = new AgentAuditSaga(
      mockCreateAuditLogHandler as unknown as CreateAuditLogHandler,
      mockAddAuditEntryHandler as unknown as AddAuditEntryHandler,
      mockAuditLogRepository as any,
    );
  });

  describe('handleAgentCreated', () => {
    it('creates an audit log when agent is created', async () => {
      const event = new AgentCreatedEvent('agent-001', 0, {
        name: 'Test',
        owner: 'owner',
        type: 'oracle',
        score: { accuracy: 80, reliability: 80, performance: 80 },
      });

      await saga.handleAgentCreated(event);

      expect(mockCreateAuditLogHandler.execute).toHaveBeenCalledTimes(1);
      const [cmd] = mockCreateAuditLogHandler.execute.mock.calls[0];
      expect(cmd.entityId).toBe('agent-001');
      expect(cmd.entityType).toBe('Agent');
    });

    it('does not propagate errors (saga isolation)', async () => {
      mockCreateAuditLogHandler.execute.mockRejectedValueOnce(new Error('DB down'));

      const event = new AgentCreatedEvent('agent-001', 0, {
        name: 'Test',
        owner: 'owner',
        type: 'oracle',
        score: { accuracy: 80, reliability: 80, performance: 80 },
      });

      // Saga should swallow errors so agent creation is not rolled back
      await expect(saga.handleAgentCreated(event)).resolves.not.toThrow();
    });
  });

  describe('handleAgentScoreUpdated', () => {
    it('adds an audit entry when score changes', async () => {
      const fakeLog = AuditLog.create('log-001', { entityId: 'agent-001', entityType: 'Agent' });
      mockAuditLogRepository.findByEntityId.mockResolvedValueOnce(fakeLog);

      const event = new AgentScoreUpdatedEvent('agent-001', 1, {
        previousScore: { accuracy: 80, reliability: 80, performance: 80 },
        newScore: { accuracy: 90, reliability: 90, performance: 90 },
      });

      await saga.handleAgentScoreUpdated(event);

      expect(mockAddAuditEntryHandler.execute).toHaveBeenCalledTimes(1);
      const [cmd] = mockAddAuditEntryHandler.execute.mock.calls[0];
      expect(cmd.action).toBe('UPDATE');
      expect(cmd.targetId).toBe('agent-001');
      expect(cmd.changes.score.before.accuracy).toBe(80);
      expect(cmd.changes.score.after.accuracy).toBe(90);
    });

    it('gracefully skips when no audit log found', async () => {
      mockAuditLogRepository.findByEntityId.mockResolvedValueOnce(null);

      const event = new AgentScoreUpdatedEvent('agent-999', 1, {
        previousScore: { accuracy: 80, reliability: 80, performance: 80 },
        newScore: { accuracy: 90, reliability: 90, performance: 90 },
      });

      await expect(saga.handleAgentScoreUpdated(event)).resolves.not.toThrow();
      expect(mockAddAuditEntryHandler.execute).not.toHaveBeenCalled();
    });
  });
});

// ─── Handler Unit Tests with mocked repositories ──────────────────────────

describe('CreateAgentHandler', () => {
  const { CreateAgentHandler } = require('../../aggregate/application/handlers/agent.handlers');
  const { AgentScore } = require('../../aggregate/domain/agent/agent-score.value-object');
  const { CreateAgentCommand } = require('../../aggregate/application/commands');

  let handler: InstanceType<typeof CreateAgentHandler>;
  let mockAgentRepo: {
    exists: jest.Mock;
    save: jest.Mock;
    findById: jest.Mock;
    findByOwner: jest.Mock;
    delete: jest.Mock;
  };
  let mockEmitter: { emit: jest.Mock };

  beforeEach(() => {
    mockAgentRepo = {
      exists: jest.fn().mockResolvedValue(false),
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findByOwner: jest.fn(),
      delete: jest.fn(),
    };
    mockEmitter = { emit: jest.fn() };
    handler = new CreateAgentHandler(mockAgentRepo, mockEmitter);
  });

  it('creates an agent and saves it', async () => {
    const cmd = new CreateAgentCommand(
      'agent-001', 'My Agent', 'owner-1', 'oracle',
      { accuracy: 80, reliability: 80, performance: 80 },
    );

    const agent = await handler.execute(cmd);

    expect(agent.id).toBe('agent-001');
    expect(mockAgentRepo.save).toHaveBeenCalledTimes(1);
  });

  it('emits domain events after save', async () => {
    const cmd = new CreateAgentCommand(
      'agent-001', 'My Agent', 'owner-1', 'oracle',
      { accuracy: 80, reliability: 80, performance: 80 },
    );

    await handler.execute(cmd);

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      'agent.created',
      expect.objectContaining({ aggregateId: 'agent-001' }),
    );
  });

  it('throws ConflictException when agent already exists', async () => {
    mockAgentRepo.exists.mockResolvedValueOnce(true);

    const cmd = new CreateAgentCommand(
      'agent-001', 'My Agent', 'owner-1', 'oracle',
      { accuracy: 80, reliability: 80, performance: 80 },
    );

    const { ConflictException } = require('@nestjs/common');
    await expect(handler.execute(cmd)).rejects.toThrow(ConflictException);
  });
});

describe('UpdateAgentScoreHandler - optimistic locking', () => {
  const { UpdateAgentScoreHandler } = require('../../aggregate/application/handlers/agent.handlers');
  const { Agent, AgentStatus } = require('../../aggregate/domain/agent/agent.aggregate');
  const { AgentScore } = require('../../aggregate/domain/agent/agent-score.value-object');
  const { UpdateAgentScoreCommand } = require('../../aggregate/application/commands');

  let handler: any;
  let mockAgentRepo: any;
  let mockEmitter: any;

  beforeEach(() => {
    mockAgentRepo = { findById: jest.fn(), save: jest.fn() };
    mockEmitter = { emit: jest.fn() };
    handler = new UpdateAgentScoreHandler(mockAgentRepo, mockEmitter);
  });

  it('throws ConflictException on version mismatch', async () => {
    const agent = Agent.create('a1', {
      name: 'n', owner: 'o', type: 't',
      score: AgentScore.create(80, 80, 80),
    });
    // version is 0, but command expects version 5
    mockAgentRepo.findById.mockResolvedValueOnce(agent);

    const cmd = new UpdateAgentScoreCommand('a1', { accuracy: 90, reliability: 90, performance: 90 }, 5);
    const { ConflictException } = require('@nestjs/common');

    await expect(handler.execute(cmd)).rejects.toThrow(ConflictException);
  });

  it('succeeds when version matches', async () => {
    const agent = Agent.create('a1', {
      name: 'n', owner: 'o', type: 't',
      score: AgentScore.create(80, 80, 80),
    });
    mockAgentRepo.findById.mockResolvedValueOnce(agent);
    mockAgentRepo.save.mockResolvedValueOnce(undefined);

    const cmd = new UpdateAgentScoreCommand('a1', { accuracy: 90, reliability: 90, performance: 90 }, 0);
    const updated = await handler.execute(cmd);

    expect(updated.score.accuracy).toBe(90);
    expect(mockAgentRepo.save).toHaveBeenCalledTimes(1);
  });
});
