import { Entity, PrimaryColumn } from 'typeorm';

@Entity('user_roles')
export class UserRole {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  roleId: string;
}