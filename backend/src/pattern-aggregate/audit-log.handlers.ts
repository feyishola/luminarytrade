import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateAuditLogCommand, AddAuditEntryCommand } from '../commands';
import { AuditLogRepository } from '../../domain/repositories.interface';
import { AuditLog } from '../../domain/audit/audit-log.aggregate';
import { AuditEntry, AuditAction } from '../../domain/audit/audit-entry.entity';

@Injectable()
export class CreateAuditLogHandler {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: CreateAuditLogCommand): Promise<AuditLog> {
    const existing = await this.auditLogRepository.findByEntityId(
      command.entityId,
      command.entityType,
    );
    if (existing) {
      throw new ConflictException(
        `AuditLog for ${command.entityType}:${command.entityId} already exists`,
      );
    }

    const log = AuditLog.create(command.logId, {
      entityId: command.entityId,
      entityType: command.entityType,
    });

    await this.auditLogRepository.save(log);
    this.publishEvents(log);

    return log;
  }

  private publishEvents(log: AuditLog): void {
    for (const event of log.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    log.clearDomainEvents();
  }
}

@Injectable()
export class AddAuditEntryHandler {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: AddAuditEntryCommand): Promise<AuditEntry> {
    const log = await this.auditLogRepository.findById(command.logId);
    if (!log) {
      throw new NotFoundException(`AuditLog ${command.logId} not found`);
    }

    const action = command.action as AuditAction;
    if (!Object.values(AuditAction).includes(action)) {
      throw new Error(`Invalid audit action: ${command.action}`);
    }

    const entry = log.addEntry({
      action,
      actorId: command.actorId,
      targetId: command.targetId,
      targetType: command.targetType,
      changes: command.changes,
      metadata: command.metadata,
      timestamp: new Date(),
    });

    await this.auditLogRepository.save(log);
    this.publishEvents(log);

    return entry;
  }

  private publishEvents(log: AuditLog): void {
    for (const event of log.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    log.clearDomainEvents();
  }
}
