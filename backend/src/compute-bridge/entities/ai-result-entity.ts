import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AIProvider {
  OPENAI = 'openai',
  GROK = 'grok',
  LLAMA = 'llama',
}

export enum AIResultStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('ai_results')
@Index(['userId', 'provider'])
@Index(['status', 'createdAt'])
export class AIResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: AIProvider,
  })
  provider: AIProvider;

  @Column({
    type: 'enum',
    enum: AIResultStatus,
    default: AIResultStatus.PENDING,
  })
  status: AIResultStatus;

  @Column('jsonb')
  request: Record<string, any>;

  @Column('jsonb', { nullable: true })
  response: Record<string, any>;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  creditScore: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  riskScore: number;

  @Column({ nullable: true })
  riskLevel: string;

  @Column('text', { nullable: true })
  signature: string;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}