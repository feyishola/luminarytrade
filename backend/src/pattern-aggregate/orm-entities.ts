import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('agents')
export class AgentOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  @Index()
  owner: string;

  @Column()
  type: string;

  @Column('jsonb')
  score: { accuracy: number; reliability: number; performance: number };

  @Column()
  status: string;

  @Column('jsonb', { default: {} })
  metadata: Record<string, unknown>;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('oracle_snapshots')
export class OracleSnapshotOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  agentId: string;

  @Column('text', { array: true })
  requiredFeeds: string[];

  @Column('jsonb')
  prices: Array<{
    feed: string;
    price: number;
    confidence: number;
    exponent: number;
    publishTime: string;
  }>;

  @Column()
  timestamp: Date;

  @VersionColumn()
  version: number;
}

@Entity('audit_logs')
export class AuditLogOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  entityId: string;

  @Column()
  @Index()
  entityType: string;

  @Column('jsonb', { default: [] })
  entries: Array<{
    entryId: string;
    action: string;
    actorId: string;
    timestamp: string;
    targetId?: string;
    targetType?: string;
    changes?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }>;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;
}
