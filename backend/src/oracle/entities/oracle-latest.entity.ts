import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

const TIMESTAMP_TYPE = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';

@Entity({ name: 'oracle_latest_prices' })
@Unique(['pair'])
export class OracleLatestPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  pair: string;

  @Column({ type: 'numeric' })
  price: string;

  @Column({ type: 'int' })
  decimals: number;

  @Column({ type: TIMESTAMP_TYPE })
  timestamp: Date;

  @Column({ type: 'uuid' })
  snapshotId: string;

  @CreateDateColumn({ type: TIMESTAMP_TYPE })
  updatedAt: Date;
}
