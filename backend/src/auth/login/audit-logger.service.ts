import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../../audit/audit-log.service';
import { AuditEventType } from '../../audit/entities/audit-log.entity';
import { User } from '../users/user.entity';

@Injectable()
export class AuthAuditLogger {
  private readonly logger = new Logger(AuthAuditLogger.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  async log(
    eventType: AuditEventType,
    user: User | null,
    metadata: Record<string, any> = {},
    description?: string,
  ): Promise<void> {
    try {
      const identifier =
        user?.publicKey ?? user?.email ?? user?.id ?? metadata.wallet ?? 'unknown';
      await this.auditLogService.logEvent(
        identifier,
        eventType,
        metadata,
        description ?? eventType,
      );
    } catch (error) {
      this.logger.warn(`Auth audit log failed: ${error.message}`);
    }
  }
}
