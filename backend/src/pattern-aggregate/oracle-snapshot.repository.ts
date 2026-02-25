import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OracleSnapshotRepository } from '../../domain/repositories.interface';
import { OracleSnapshot } from '../../domain/oracle/oracle-snapshot.aggregate';
import { OracleSnapshotOrmEntity } from '../entities/orm-entities';

@Injectable()
export class TypeOrmOracleSnapshotRepository implements OracleSnapshotRepository {
  constructor(
    @InjectRepository(OracleSnapshotOrmEntity)
    private readonly ormRepo: Repository<OracleSnapshotOrmEntity>,
  ) {}

  async findById(id: string): Promise<OracleSnapshot | null> {
    const record = await this.ormRepo.findOne({ where: { id } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findLatestByAgentId(agentId: string): Promise<OracleSnapshot | null> {
    const record = await this.ormRepo.findOne({
      where: { agentId },
      order: { timestamp: 'DESC' },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByAgentId(agentId: string, limit = 10): Promise<OracleSnapshot[]> {
    const records = await this.ormRepo.find({
      where: { agentId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(snapshot: OracleSnapshot): Promise<void> {
    const state = snapshot.toState();
    const existing = await this.ormRepo.findOne({ where: { id: state.id } });

    const pricesForDb = state.prices.map((p) => ({
      ...p,
      publishTime: p.publishTime.toISOString(),
    }));

    if (existing) {
      const result = await this.ormRepo
        .createQueryBuilder()
        .update(OracleSnapshotOrmEntity)
        .set({
          requiredFeeds: state.requiredFeeds,
          prices: pricesForDb,
          timestamp: state.timestamp,
          version: () => 'version + 1',
        })
        .where('id = :id AND version = :version', {
          id: state.id,
          version: existing.version,
        })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException(
          `Optimistic locking conflict for OracleSnapshot ${state.id}`,
        );
      }
    } else {
      await this.ormRepo.insert({
        id: state.id,
        agentId: state.agentId,
        requiredFeeds: state.requiredFeeds,
        prices: pricesForDb,
        timestamp: state.timestamp,
        version: 0,
      });
    }
  }

  async exists(id: string): Promise<boolean> {
    return this.ormRepo.exists({ where: { id } });
  }

  private toDomain(record: OracleSnapshotOrmEntity): OracleSnapshot {
    return OracleSnapshot.reconstitute({
      id: record.id,
      agentId: record.agentId,
      requiredFeeds: record.requiredFeeds,
      prices: record.prices.map((p) => ({
        ...p,
        publishTime: new Date(p.publishTime),
      })),
      timestamp: record.timestamp,
      version: record.version,
    });
  }
}
