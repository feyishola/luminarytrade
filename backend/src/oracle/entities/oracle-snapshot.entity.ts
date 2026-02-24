import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

const TIMESTAMP_TYPE = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';
const JSON_TYPE = process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb';

@Entity({ name: 'oracle_snapshots' })
export class OracleSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: TIMESTAMP_TYPE })
  timestamp: Date;

  @Column({ type: 'text' })
  signer: string;

  @Column({ type: 'text' })
  signature: string;

  @Column({ type: JSON_TYPE })
  feeds: any; // array of { pair, price, decimals }

  @CreateDateColumn({ type: TIMESTAMP_TYPE })
  createdAt: Date;
}
