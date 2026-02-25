import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('agent_read_model')
export class AgentReadModel {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  score: number;

  @Column()
  totalTrades: number;

  @Column()
  lastUpdated: Date;
}