import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('authorization_audit')
export class AuthorizationAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  resource: string;

  @Column()
  action: string;

  @Column()
  allowed: boolean;

  @Column({ nullable: true })
  reason?: string;

  @CreateDateColumn()
  timestamp: Date;
}