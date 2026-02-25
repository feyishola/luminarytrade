import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SagaState } from '../saga.base';

@Entity('saga_data')
export class SagaDataEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sagaType: string;

  @Column({
    type: 'enum',
    enum: SagaState,
    default: SagaState.STARTED,
  })
  state: SagaState;

  @Column({ default: 0 })
  currentStep: number;

  @Column('jsonb')
  data: Record<string, any>;

  @Column({ type: 'timestamp', precision: 3 })
  createdAt: Date;

  @Column({ type: 'timestamp', precision: 3 })
  updatedAt: Date;

  @Column({ nullable: true })
  error: string;
}
