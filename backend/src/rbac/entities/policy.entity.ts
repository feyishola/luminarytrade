import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Action } from '../../common/constant/actions.enum';

@Entity('policies')
@Index(['resource', 'action'])
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  resource: string;

  @Column({ type: 'enum', enum: Action })
  action: Action;

  @Column({ type: 'simple-json', nullable: true })
  conditionJson?: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
