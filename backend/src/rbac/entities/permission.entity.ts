import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Action } from '../../common/constant/actions.enum';

@Entity('permissions')
@Index(['resource', 'action'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  resource: string;

  @Column({ type: 'enum', enum: Action })
  action: Action;
}
