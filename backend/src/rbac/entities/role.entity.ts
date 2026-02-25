import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @Column({ default: false })
  isSystem: boolean;

  @Column({ nullable: true })
  parentRoleId?: string;

  @ManyToMany(() => Permission, { eager: true })
  @JoinTable({ name: 'role_permissions' })
  permissions: Permission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}