import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('event_store')
@Index(['aggregateId', 'version'])
@Index(['eventType'])
@Index(['timestamp'])
export class EventStoreEntity {
  @PrimaryGeneratedColumn('uuid')
  eventId: string;

  @Column()
  aggregateId: string;

  @Column()
  aggregateType: string;

  @Column()
  eventType: string;

  @Column('jsonb')
  payload: Record<string, any>;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column()
  version: number;

  @Column({ type: 'timestamp', precision: 3 })
  timestamp: Date;

  @Column({ nullable: true })
  correlationId: string;

  @Column({ nullable: true })
  causationId: string;

  @CreateDateColumn()
  createdAt: Date;
}
