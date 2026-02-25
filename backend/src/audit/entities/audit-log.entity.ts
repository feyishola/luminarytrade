import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum AuditEventType {
  AUTH_LOGIN_SUCCESS = 'auth_login_success',
  AUTH_LOGIN_FAILURE = 'auth_login_failure',
  AUTH_LOGOUT = 'auth_logout',
  AUTH_REFRESH = 'auth_refresh',
  AUTH_TOKEN_REVOKED = 'auth_token_revoked',
  AUTH_SIGNUP = 'auth_signup',
  AUTH_EMAIL_VERIFIED = 'auth_email_verified',
  AI_SCORING_STARTED = 'ai_scoring_started',
  AI_SCORING_COMPLETED = 'ai_scoring_completed',
  AI_SCORING_FAILED = 'ai_scoring_failed',
  CONTRACT_CALL_INITIATED = 'contract_call_initiated',
  CONTRACT_CALL_COMPLETED = 'contract_call_completed',
  CONTRACT_CALL_FAILED = 'contract_call_failed',
  ORACLE_UPDATE_INITIATED = 'oracle_update_initiated',
  ORACLE_UPDATE_COMPLETED = 'oracle_update_completed',
  ORACLE_UPDATE_FAILED = 'oracle_update_failed',
  SUBMISSION_CREATED = 'submission_created',
  SUBMISSION_COMPLETED = 'submission_completed',
  SUBMISSION_FAILED = 'submission_failed',
}

@Entity('audit_logs')
@Index(['wallet'])
@Index(['eventType'])
@Index(['timestamp'])
@Index(['wallet', 'eventType'])
@Index(['timestamp', 'eventType'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  wallet: string;

  @Column({
    type: 'enum',
    enum: AuditEventType,
  })
  eventType: AuditEventType;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @Column('text', { nullable: true })
  description: string;

  @Column({ nullable: true })
  relatedEntityId: string;

  @Column({ nullable: true })
  relatedEntityType: string;

  @CreateDateColumn()
  timestamp: Date;
}
