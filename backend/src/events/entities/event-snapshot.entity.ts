import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('event_snapshots')
@Index(['aggregateId', 'aggregateType'])
@Index(['version'])
export class EventSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  aggregateId: string;

  @Column()
  aggregateType: string;

  @Column('jsonb')
  data: Record<string, any>;

  @Column()
  version: number;

  @Column({ type: 'timestamp', precision: 3 })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
