import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogRepository } from '../../domain/repositories.interface';
import { AuditLog } from '../../domain/audit/audit-log.aggregate';
import { AuditLogOrmEntity } from '../entities/orm-entities';

@Injectable()
export class TypeOrmAuditLogRepository implements AuditLogRepository {
  constructor(
    @InjectRepository(AuditLogOrmEntity)
    private readonly ormRepo: Repository<AuditLogOrmEntity>,
  ) {}

  async findById(id: string): Promise<AuditLog | null> {
    const record = await this.ormRepo.findOne({ where: { id } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByEntityId(entityId: string, entityType: string): Promise<AuditLog | null> {
    const record = await this.ormRepo.findOne({ where: { entityId, entityType } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async save(log: AuditLog): Promise<void> {
    const state = log.toState();
    const existing = await this.ormRepo.findOne({ where: { id: state.id } });

    if (existing) {
      const result = await this.ormRepo
        .createQueryBuilder()
        .update(AuditLogOrmEntity)
        .set({
          entries: state.entries,
          version: () => 'version + 1',
        })
        .where('id = :id AND version = :version', {
          id: state.id,
          version: existing.version,
        })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException(
          `Optimistic locking conflict for AuditLog ${state.id}`,
        );
      }
    } else {
      await this.ormRepo.insert({
        id: state.id,
        entityId: state.entityId,
        entityType: state.entityType,
        entries: state.entries,
        version: 0,
        createdAt: state.createdAt,
      });
    }
  }

  private toDomain(record: AuditLogOrmEntity): AuditLog {
    return AuditLog.reconstitute({
      id: record.id,
      entityId: record.entityId,
      entityType: record.entityType,
      entries: record.entries.map((e) => ({
        ...e,
        timestamp: e.timestamp,
      })),
      version: record.version,
      createdAt: record.createdAt,
    });
  }
}
