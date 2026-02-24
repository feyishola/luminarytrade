import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { AuditLogEntity, AuditEventType } from './entities/audit-log.entity';
import { FetchAuditLogsDto } from './dto/fetch-audit-logs.dto';
import { IEventBus } from '../events/interfaces/event-bus.interface';
import { AuditLogCreatedEvent } from '../events/domain-events/audit.events';
import { Optional } from '@nestjs/common';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private auditLogRepository: Repository<AuditLogEntity>,
    @Optional()
    @Inject("EventBus")
    private readonly eventBus?: IEventBus,
  ) {}

  async logEvent(
    wallet: string,
    eventType: AuditEventType,
    metadata: Record<string, any> = {},
    description?: string,
    relatedEntityId?: string,
    relatedEntityType?: string,
  ): Promise<AuditLogEntity> {
    try {
      const auditLog = this.auditLogRepository.create({
        wallet,
        eventType,
        metadata,
        description,
        relatedEntityId,
        relatedEntityType,
      });

      const saved = await this.auditLogRepository.save(auditLog);
      this.logger.log(
        `Audit log created: ${eventType} for wallet ${wallet}`,
      );

      // Emit Audit Log Created Event
      const auditLogCreatedEvent = new AuditLogCreatedEvent(
        saved.id,
        {
          wallet: saved.wallet,
          eventType: saved.eventType,
          metadata: saved.metadata,
          description: saved.description,
          relatedEntityId: saved.relatedEntityId,
          relatedEntityType: saved.relatedEntityType,
        },
      );
      if (this.eventBus) {
        await this.eventBus.publish(auditLogCreatedEvent);
      }

      return saved;
    } catch (error) {
      this.logger.error(
        `Failed to create audit log: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async fetchAuditLogs(
    query: FetchAuditLogsDto,
  ): Promise<{ logs: AuditLogEntity[]; total: number }> {
    const where: FindOptionsWhere<AuditLogEntity> = {};

    if (query.wallet) {
      where.wallet = query.wallet;
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.startDate || query.endDate) {
      where.timestamp = Between(
        query.startDate || new Date(0),
        query.endDate || new Date(),
      );
    }

    try {
      const [logs, total] = await this.auditLogRepository.findAndCount({
        where,
        order: { timestamp: 'DESC' },
        take: query.limit || 50,
        skip: query.offset || 0,
      });

      return { logs, total };
    } catch (error) {
      this.logger.error(
        `Failed to fetch audit logs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getLogsByWallet(wallet: string, limit: number = 50): Promise<AuditLogEntity[]> {
    return this.auditLogRepository.find({
      where: { wallet },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getLogsByEventType(
    eventType: AuditEventType,
    limit: number = 50,
  ): Promise<AuditLogEntity[]> {
    return this.auditLogRepository.find({
      where: { eventType },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getLogsByRelatedEntity(
    relatedEntityId: string,
    limit: number = 50,
  ): Promise<AuditLogEntity[]> {
    return this.auditLogRepository.find({
      where: { relatedEntityId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
