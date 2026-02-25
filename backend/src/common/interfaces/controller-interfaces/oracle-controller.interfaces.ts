import { UpdateOracleDto } from '../../../oracle/dto/update-oracle.dto';
import { FeedPrice } from '../../../oracle/oracle.service';

// CRUD operations for Oracle
export interface IOracleCRUD {
  update(dto: UpdateOracleDto): Promise<any>;
}

// Query operations for Oracle
export interface IOracleQuery {
  latest(): Promise<{ ok: boolean; values: FeedPrice[] }>;
}

// Analytics operations for Oracle
export interface IOracleAnalytics {
  getStats(): Promise<any>; // Define specific stats type as needed
}