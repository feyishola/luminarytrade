import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// ORM Entities
import {
  AgentOrmEntity,
  OracleSnapshotOrmEntity,
  AuditLogOrmEntity,
} from './infrastructure/entities/orm-entities';

// Repositories (abstract tokens)
import {
  AgentRepository,
  OracleSnapshotRepository,
  AuditLogRepository,
} from './domain/repositories.interface';

// Repository implementations
import { TypeOrmAgentRepository } from './infrastructure/repositories/agent.repository';
import { TypeOrmOracleSnapshotRepository } from './infrastructure/repositories/oracle-snapshot.repository';
import { TypeOrmAuditLogRepository } from './infrastructure/repositories/audit-log.repository';

// Handlers
import {
  CreateAgentHandler,
  UpdateAgentScoreHandler,
  DeactivateAgentHandler,
} from './application/handlers/agent.handlers';
import { RecordOracleSnapshotHandler } from './application/handlers/oracle-snapshot.handler';
import { CreateAuditLogHandler, AddAuditEntryHandler } from './application/handlers/audit-log.handlers';

// Sagas
import { AgentAuditSaga } from './application/sagas/agent-audit.saga';

const REPOSITORIES = [
  { provide: AgentRepository, useClass: TypeOrmAgentRepository },
  { provide: OracleSnapshotRepository, useClass: TypeOrmOracleSnapshotRepository },
  { provide: AuditLogRepository, useClass: TypeOrmAuditLogRepository },
];

const HANDLERS = [
  CreateAgentHandler,
  UpdateAgentScoreHandler,
  DeactivateAgentHandler,
  RecordOracleSnapshotHandler,
  CreateAuditLogHandler,
  AddAuditEntryHandler,
];

const SAGAS = [AgentAuditSaga];

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentOrmEntity, OracleSnapshotOrmEntity, AuditLogOrmEntity]),
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.' }),
  ],
  providers: [...REPOSITORIES, ...HANDLERS, ...SAGAS],
  exports: [
    // Export handlers so controllers can call them
    CreateAgentHandler,
    UpdateAgentScoreHandler,
    DeactivateAgentHandler,
    RecordOracleSnapshotHandler,
    CreateAuditLogHandler,
    AddAuditEntryHandler,
    // Export repositories for module-internal use in other parts of the app
    AgentRepository,
    OracleSnapshotRepository,
    AuditLogRepository,
  ],
})
export class AggregateModule {}
