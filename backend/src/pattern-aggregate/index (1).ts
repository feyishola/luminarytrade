// Module
export { AggregateModule } from './aggregate.module';

// Domain - Aggregates
export { Agent, AgentStatus, AgentProps, AgentState } from './domain/agent/agent.aggregate';
export { OracleSnapshot, OracleSnapshotProps, OracleSnapshotState } from './domain/oracle/oracle-snapshot.aggregate';
export { AuditLog, AuditLogProps, AuditLogState } from './domain/audit/audit-log.aggregate';

// Domain - Entities (accessible only through roots externally)
export { OracleLatestPrice } from './domain/oracle/oracle-latest-price.entity';
export { AuditEntry, AuditAction, AuditEntryProps } from './domain/audit/audit-entry.entity';

// Domain - Value Objects
export { AgentScore } from './domain/agent/agent-score.value-object';

// Domain - Events
export {
  AgentCreatedEvent,
  AgentScoreUpdatedEvent,
  AgentDeactivatedEvent,
} from './domain/agent/agent-events';
export {
  OracleSnapshotRecordedEvent,
  OracleSnapshotPriceUpdatedEvent,
} from './domain/oracle/oracle-events';
export {
  AuditLogCreatedEvent,
  AuditEntryAddedEvent,
} from './domain/audit/audit-events';

// Domain - Repository Interfaces
export {
  AgentRepository,
  OracleSnapshotRepository,
  AuditLogRepository,
} from './domain/repositories.interface';

// Application - Commands
export {
  CreateAgentCommand,
  UpdateAgentScoreCommand,
  DeactivateAgentCommand,
  RecordOracleSnapshotCommand,
  CreateAuditLogCommand,
  AddAuditEntryCommand,
} from './application/commands';

// Application - Handlers
export { CreateAgentHandler, UpdateAgentScoreHandler, DeactivateAgentHandler } from './application/handlers/agent.handlers';
export { RecordOracleSnapshotHandler } from './application/handlers/oracle-snapshot.handler';
export { CreateAuditLogHandler, AddAuditEntryHandler } from './application/handlers/audit-log.handlers';

// Infrastructure - ORM Entities (for TypeORM forFeature registration)
export { AgentOrmEntity, OracleSnapshotOrmEntity, AuditLogOrmEntity } from './infrastructure/entities/orm-entities';
