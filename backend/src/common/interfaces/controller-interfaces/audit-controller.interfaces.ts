import { FetchAuditLogsDto } from '../../../audit/dto/fetch-audit-logs.dto';
import { AuditLogEntity, AuditEventType } from '../../../audit/entities/audit-log.entity';

// Query operations for Audit Logs
export interface IAuditLogQuery {
  getAuditLogs(query: FetchAuditLogsDto): Promise<{ logs: AuditLogEntity[]; total: number }>;
  getLogsByWallet(wallet: string, limit?: number): Promise<AuditLogEntity[]>;
  getLogsByEventType(eventType: AuditEventType, limit?: number): Promise<AuditLogEntity[]>;
  getLogsByEntity(relatedEntityId: string, limit?: number): Promise<AuditLogEntity[]>;
}

// Analytics operations for Audit Logs
export interface IAuditLogAnalytics {
  getStatistics(): Promise<any>; // Define specific stats type as needed
}