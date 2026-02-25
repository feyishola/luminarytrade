import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentRepository } from '../../domain/repositories.interface';
import { Agent, AgentStatus } from '../../domain/agent/agent.aggregate';
import { AgentScore } from '../../domain/agent/agent-score.value-object';
import { AgentOrmEntity } from '../entities/orm-entities';

@Injectable()
export class TypeOrmAgentRepository implements AgentRepository {
  constructor(
    @InjectRepository(AgentOrmEntity)
    private readonly ormRepo: Repository<AgentOrmEntity>,
  ) {}

  async findById(id: string): Promise<Agent | null> {
    const record = await this.ormRepo.findOne({ where: { id } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByOwner(owner: string): Promise<Agent[]> {
    const records = await this.ormRepo.find({ where: { owner } });
    return records.map((r) => this.toDomain(r));
  }

  async save(agent: Agent): Promise<void> {
    const state = agent.toState();
    const existing = await this.ormRepo.findOne({ where: { id: state.id } });

    if (existing) {
      // Optimistic locking: ensure the version we are saving from is current
      // TypeORM's @VersionColumn handles this automatically, but we explicitly check
      const result = await this.ormRepo
        .createQueryBuilder()
        .update(AgentOrmEntity)
        .set({
          name: state.name,
          owner: state.owner,
          type: state.type,
          score: state.score,
          status: state.status,
          metadata: state.metadata,
          updatedAt: state.updatedAt,
          version: () => 'version + 1',
        })
        .where('id = :id AND version = :version', {
          id: state.id,
          version: existing.version,
        })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException(
          `Optimistic locking conflict for Agent ${state.id}: ` +
          `record was modified by another transaction`,
        );
      }
    } else {
      await this.ormRepo.insert({
        id: state.id,
        name: state.name,
        owner: state.owner,
        type: state.type,
        score: state.score,
        status: state.status,
        metadata: state.metadata,
        version: 0,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      });
    }
  }

  async delete(id: string): Promise<void> {
    await this.ormRepo.delete({ id });
  }

  async exists(id: string): Promise<boolean> {
    return this.ormRepo.exists({ where: { id } });
  }

  private toDomain(record: AgentOrmEntity): Agent {
    return Agent.reconstitute({
      id: record.id,
      name: record.name,
      owner: record.owner,
      type: record.type,
      score: record.score,
      status: record.status as AgentStatus,
      metadata: record.metadata,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
