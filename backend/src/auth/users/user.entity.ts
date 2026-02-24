import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';

@Entity('users')
@Index(['email'], { unique: true })
@Index(['publicKey'], { unique: true })
@Index(['socialProvider', 'socialId'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  email: string | null;

  @Column({ nullable: true })
  passwordHash: string | null;

  @Column({ nullable: true })
  publicKey: string | null;

  @Column({ nullable: true })
  socialProvider: string | null;

  @Column({ nullable: true })
  socialId: string | null;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'simple-array', default: 'user' })
  roles: string[];

  @Column({ default: 'free' })
  tier: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens?: RefreshToken[];
}
