import { Agent } from '../domain/agent/agent.aggregate';
import { OracleSnapshot } from '../domain/oracle/oracle-snapshot.aggregate';
import { AuditLog } from '../domain/audit/audit-log.aggregate';

export abstract class AgentRepository {
  abstract findById(id: string): Promise<Agent | null>;
  abstract findByOwner(owner: string): Promise<Agent[]>;
  abstract save(agent: Agent): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract exists(id: string): Promise<boolean>;
}

export abstract class OracleSnapshotRepository {
  abstract findById(id: string): Promise<OracleSnapshot | null>;
  abstract findLatestByAgentId(agentId: string): Promise<OracleSnapshot | null>;
  abstract findByAgentId(agentId: string, limit?: number): Promise<OracleSnapshot[]>;
  abstract save(snapshot: OracleSnapshot): Promise<void>;
  abstract exists(id: string): Promise<boolean>;
}

export abstract class AuditLogRepository {
  abstract findById(id: string): Promise<AuditLog | null>;
  abstract findByEntityId(entityId: string, entityType: string): Promise<AuditLog | null>;
  abstract save(log: AuditLog): Promise<void>;
}
