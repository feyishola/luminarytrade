import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AgentCreatedEvent } from '../../domain/agent/agent-events';
import { AgentScoreUpdatedEvent } from '../../domain/agent/agent-events';
import { OracleSnapshotRecordedEvent } from '../../domain/oracle/oracle-events';
import { CreateAuditLogHandler, AddAuditEntryHandler } from '../handlers/audit-log.handlers';
import { CreateAuditLogCommand, AddAuditEntryCommand } from '../commands';
import { AuditLogRepository } from '../../domain/repositories.interface';
import { v4 as uuid } from 'uuid';

/**
 * MultiAggregateSaga coordinates cross-aggregate operations triggered by domain events.
 * This avoids direct cross-aggregate transactions by reacting to events asynchronously.
 *
 * Pattern:
 *  1. Agent aggregate emits domain events
 *  2. Saga listens and triggers AuditLog operations
 *  3. Each step is a separate transaction scoped to one aggregate
 */
@Injectable()
export class AgentAuditSaga {
  private readonly logger = new Logger(AgentAuditSaga.name);

  constructor(
    private readonly createAuditLogHandler: CreateAuditLogHandler,
    private readonly addAuditEntryHandler: AddAuditEntryHandler,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  @OnEvent('agent.created', { async: true })
  async handleAgentCreated(event: AgentCreatedEvent): Promise<void> {
    try {
      // Step 1: Create an audit log for the new agent aggregate
      const logId = uuid();
      await this.createAuditLogHandler.execute(
        new CreateAuditLogCommand(logId, event.aggregateId, 'Agent'),
      );

      this.logger.log(`Created AuditLog ${logId} for new Agent ${event.aggregateId}`);
    } catch (error) {
      this.logger.error(
        `AgentAuditSaga: failed to create audit log for agent ${event.aggregateId}`,
        error,
      );
      // In production: push to a dead-letter queue / retry mechanism
    }
  }

  @OnEvent('agent.score_updated', { async: true })
  async handleAgentScoreUpdated(event: AgentScoreUpdatedEvent): Promise<void> {
    try {
      const log = await this.auditLogRepository.findByEntityId(event.aggregateId, 'Agent');
      if (!log) {
        this.logger.warn(`No AuditLog found for Agent ${event.aggregateId}`);
        return;
      }

      await this.addAuditEntryHandler.execute(
        new AddAuditEntryCommand(
          log.id,
          'UPDATE',
          'system', // system actor for automated audit
          event.aggregateId,
          'Agent',
          {
            score: {
              before: event.payload.previousScore,
              after: event.payload.newScore,
            },
          },
        ),
      );

      this.logger.log(`Recorded score update in AuditLog for Agent ${event.aggregateId}`);
    } catch (error) {
      this.logger.error(
        `AgentAuditSaga: failed to add audit entry for agent ${event.aggregateId}`,
        error,
      );
    }
  }

  @OnEvent('oracle.snapshot_recorded', { async: true })
  async handleOracleSnapshotRecorded(event: OracleSnapshotRecordedEvent): Promise<void> {
    try {
      const log = await this.auditLogRepository.findByEntityId(event.payload.agentId, 'Agent');
      if (!log) {
        this.logger.warn(`No AuditLog found for Agent ${event.payload.agentId}`);
        return;
      }

      await this.addAuditEntryHandler.execute(
        new AddAuditEntryCommand(
          log.id,
          'CREATE',
          'oracle-service',
          event.aggregateId,
          'OracleSnapshot',
          undefined,
          {
            feeds: event.payload.feeds,
            snapshotTimestamp: event.payload.timestamp,
          },
        ),
      );
    } catch (error) {
      this.logger.error(
        `AgentAuditSaga: failed to record oracle snapshot audit for agent ${event.payload.agentId}`,
        error,
      );
    }
  }
}
