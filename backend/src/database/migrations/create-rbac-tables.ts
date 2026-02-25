import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRBACTables1700000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE roles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar UNIQUE NOT NULL,
        description varchar NOT NULL,
        isSystem boolean DEFAULT false,
        parentRoleId varchar,
        createdAt timestamptz DEFAULT now(),
        updatedAt timestamptz DEFAULT now()
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE roles`);
  }
}