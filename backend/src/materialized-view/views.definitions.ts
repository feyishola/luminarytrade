import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  MaterializedView,
  RefreshStrategy,
  ViewStatus,
} from "./materialized-view.base";

// ─── DTOs returned by views ────────────────────────────────────────────────

export interface TopAgentsByScore {
  agentId: string;
  agentName: string;
  totalScore: number;
  avgScore: number;
  scoreCount: number;
  rank: number;
  percentile: number;
  lastScoredAt: Date;
}

export interface UserScoringHistoryEntry {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  totalScore: number;
  scoreCount: number;
  avgScore: number;
  topAgentId: string | null;
  delta: number; // change from previous period
}

export interface OraclePriceStats {
  oracleId: string;
  assetSymbol: string;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  stdDev: number;
  sampleCount: number;
  periodStart: Date;
  periodEnd: Date;
  lastUpdatedAt: Date;
}

export interface AuditSummaryEntry {
  entityType: string;
  entityId: string;
  actionType: string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  actorIds: string[];
}

// ─── TopAgentsByScoreView ──────────────────────────────────────────────────

@Injectable()
export class TopAgentsByScoreView extends MaterializedView<TopAgentsByScore> {
  // Acceptable staleness: 5 minutes (300s)
  constructor(
    private readonly dataSource: DataSource,
    eventEmitter: EventEmitter2,
  ) {
    super("TopAgentsByScoreView", 300, RefreshStrategy.SCHEDULED, eventEmitter);
  }

  protected async buildFull(): Promise<void> {
    await this.dataSource.query(`
      DROP TABLE IF EXISTS mv_top_agents_by_score;

      CREATE TABLE mv_top_agents_by_score AS
      WITH scored AS (
        SELECT
          a.id                            AS agent_id,
          a.name                          AS agent_name,
          COUNT(s.id)                     AS score_count,
          SUM(s.value)                    AS total_score,
          AVG(s.value)                    AS avg_score,
          MAX(s.created_at)               AS last_scored_at
        FROM agents a
        LEFT JOIN scores s ON s.agent_id = a.id
        GROUP BY a.id, a.name
      ),
      ranked AS (
        SELECT *,
          RANK() OVER (ORDER BY total_score DESC)                              AS rank,
          PERCENT_RANK() OVER (ORDER BY total_score)                          AS percentile
        FROM scored
      )
      SELECT * FROM ranked;

      CREATE INDEX idx_mv_top_agents_rank     ON mv_top_agents_by_score (rank);
      CREATE INDEX idx_mv_top_agents_score    ON mv_top_agents_by_score (total_score DESC);
      CREATE INDEX idx_mv_top_agents_agent_id ON mv_top_agents_by_score (agent_id);
    `);
  }

  protected async buildIncremental(since: Date): Promise<void> {
    // Upsert agents whose scores changed since checkpoint
    await this.dataSource.query(
      `
      INSERT INTO mv_top_agents_by_score (agent_id, agent_name, score_count, total_score, avg_score, last_scored_at, rank, percentile)
      WITH scored AS (
        SELECT
          a.id, a.name,
          COUNT(s.id)   AS score_count,
          SUM(s.value)  AS total_score,
          AVG(s.value)  AS avg_score,
          MAX(s.created_at) AS last_scored_at
        FROM agents a
        JOIN scores s ON s.agent_id = a.id
        WHERE s.created_at >= $1
        GROUP BY a.id, a.name
      )
      SELECT *, 0 AS rank, 0 AS percentile FROM scored
      ON CONFLICT (agent_id) DO UPDATE
        SET score_count    = EXCLUDED.score_count,
            total_score    = EXCLUDED.total_score,
            avg_score      = EXCLUDED.avg_score,
            last_scored_at = EXCLUDED.last_scored_at;

      -- Recompute ranks after upsert
      WITH ranked AS (
        SELECT agent_id,
          RANK() OVER (ORDER BY total_score DESC) AS rank,
          PERCENT_RANK() OVER (ORDER BY total_score) AS percentile
        FROM mv_top_agents_by_score
      )
      UPDATE mv_top_agents_by_score m
      SET rank = r.rank, percentile = r.percentile
      FROM ranked r
      WHERE m.agent_id = r.agent_id;
    `,
      [since],
    );
  }

  async queryTopN(
    limit = 100,
    hints?: { useIndex?: string },
  ): Promise<TopAgentsByScore[]> {
    return this.query(`top_${limit}`, async () => {
      const indexHint = hints?.useIndex
        ? `/*+ INDEX(mv_top_agents_by_score ${hints.useIndex}) */`
        : "";
      const rows = await this.dataSource.query(
        `SELECT ${indexHint} agent_id, agent_name, total_score, avg_score, score_count, rank, percentile, last_scored_at
         FROM mv_top_agents_by_score ORDER BY rank LIMIT $1`,
        [limit],
      );
      return rows.map((r: Record<string, unknown>) => ({
        agentId: r.agent_id,
        agentName: r.agent_name,
        totalScore: Number(r.total_score),
        avgScore: Number(r.avg_score),
        scoreCount: Number(r.score_count),
        rank: Number(r.rank),
        percentile: Number(r.percentile),
        lastScoredAt: new Date(r.last_scored_at as string),
      }));
    });
  }

  protected async countRows(): Promise<number> {
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) AS count FROM mv_top_agents_by_score`,
    );
    return Number(count);
  }

  protected async estimateSizeBytes(): Promise<number> {
    const [row] = await this.dataSource
      .query(`SELECT pg_total_relation_size('mv_top_agents_by_score') AS size`)
      .catch(() => [{ size: 0 }]);
    return Number(row?.size ?? 0);
  }

  protected async detectCorruption(): Promise<boolean> {
    try {
      await this.dataSource.query(
        `SELECT 1 FROM mv_top_agents_by_score LIMIT 1`,
      );
      return false;
    } catch {
      return true;
    }
  }

  protected async recreateStructures(): Promise<void> {
    await this.dataSource.query(`DROP TABLE IF EXISTS mv_top_agents_by_score`);
  }
}

// ─── UserScoringHistoryView ────────────────────────────────────────────────

@Injectable()
export class UserScoringHistoryView extends MaterializedView<UserScoringHistoryEntry> {
  constructor(
    private readonly dataSource: DataSource,
    eventEmitter: EventEmitter2,
  ) {
    super(
      "UserScoringHistoryView",
      600,
      RefreshStrategy.EVENT_DRIVEN,
      eventEmitter,
    );
  }

  protected async buildFull(): Promise<void> {
    await this.dataSource.query(`
      DROP TABLE IF EXISTS mv_user_scoring_history;

      CREATE TABLE mv_user_scoring_history AS
      WITH weekly AS (
        SELECT
          user_id,
          date_trunc('week', created_at)          AS period_start,
          date_trunc('week', created_at) + INTERVAL '6 days 23:59:59' AS period_end,
          SUM(value)                              AS total_score,
          COUNT(*)                                AS score_count,
          AVG(value)                              AS avg_score,
          agent_id AS top_agent_id
        FROM scores
        GROUP BY user_id, date_trunc('week', created_at), agent_id
      ),
      with_delta AS (
        SELECT *,
          total_score - LAG(total_score, 1, 0) OVER (PARTITION BY user_id ORDER BY period_start) AS delta
        FROM weekly
      )
      SELECT * FROM with_delta;

      CREATE INDEX idx_mv_ush_user_id ON mv_user_scoring_history (user_id);
      CREATE INDEX idx_mv_ush_period  ON mv_user_scoring_history (period_start DESC);
    `);
  }

  protected async buildIncremental(since: Date): Promise<void> {
    // Rebuild only affected weeks
    await this.dataSource.query(
      `
      DELETE FROM mv_user_scoring_history
      WHERE period_start >= date_trunc('week', $1::timestamptz);
    `,
      [since],
    );

    await this.dataSource.query(
      `
      INSERT INTO mv_user_scoring_history
      WITH weekly AS (
        SELECT
          user_id,
          date_trunc('week', created_at) AS period_start,
          date_trunc('week', created_at) + INTERVAL '6 days 23:59:59' AS period_end,
          SUM(value) AS total_score,
          COUNT(*) AS score_count,
          AVG(value) AS avg_score,
          agent_id AS top_agent_id
        FROM scores
        WHERE created_at >= date_trunc('week', $1::timestamptz)
        GROUP BY user_id, date_trunc('week', created_at), agent_id
      )
      SELECT *, 0 AS delta FROM weekly;
    `,
      [since],
    );
  }

  async queryByUser(
    userId: string,
    limit = 52,
  ): Promise<UserScoringHistoryEntry[]> {
    return this.query(`user_${userId}_${limit}`, async () => {
      const rows = await this.dataSource.query(
        `SELECT * FROM mv_user_scoring_history WHERE user_id = $1 ORDER BY period_start DESC LIMIT $2`,
        [userId, limit],
      );
      return rows.map((r: Record<string, unknown>) => ({
        userId: r.user_id as string,
        periodStart: new Date(r.period_start as string),
        periodEnd: new Date(r.period_end as string),
        totalScore: Number(r.total_score),
        scoreCount: Number(r.score_count),
        avgScore: Number(r.avg_score),
        topAgentId: r.top_agent_id as string | null,
        delta: Number(r.delta),
      }));
    });
  }

  protected async countRows(): Promise<number> {
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) AS count FROM mv_user_scoring_history`,
    );
    return Number(count);
  }

  protected async estimateSizeBytes(): Promise<number> {
    const [row] = await this.dataSource
      .query(`SELECT pg_total_relation_size('mv_user_scoring_history') AS size`)
      .catch(() => [{ size: 0 }]);
    return Number(row?.size ?? 0);
  }

  protected async detectCorruption(): Promise<boolean> {
    try {
      await this.dataSource.query(
        `SELECT 1 FROM mv_user_scoring_history LIMIT 1`,
      );
      return false;
    } catch {
      return true;
    }
  }

  protected async recreateStructures(): Promise<void> {
    await this.dataSource.query(`DROP TABLE IF EXISTS mv_user_scoring_history`);
  }
}

// ─── OraclePriceStatsView ─────────────────────────────────────────────────

@Injectable()
export class OraclePriceStatsView extends MaterializedView<OraclePriceStats> {
  constructor(
    private readonly dataSource: DataSource,
    eventEmitter: EventEmitter2,
  ) {
    // Price stats acceptable staleness: 60 seconds
    super("OraclePriceStatsView", 60, RefreshStrategy.SCHEDULED, eventEmitter);
  }

  protected async buildFull(): Promise<void> {
    await this.dataSource.query(`
      DROP TABLE IF EXISTS mv_oracle_price_stats;

      CREATE TABLE mv_oracle_price_stats AS
      SELECT
        oracle_id,
        asset_symbol,
        MIN(price)            AS min_price,
        MAX(price)            AS max_price,
        AVG(price)            AS avg_price,
        STDDEV(price)         AS std_dev,
        COUNT(*)              AS sample_count,
        MIN(created_at)       AS period_start,
        MAX(created_at)       AS period_end,
        NOW()                 AS last_updated_at
      FROM oracle_price_feeds
      GROUP BY oracle_id, asset_symbol;

      CREATE INDEX idx_mv_ops_oracle_id ON mv_oracle_price_stats (oracle_id);
      CREATE INDEX idx_mv_ops_symbol    ON mv_oracle_price_stats (asset_symbol);
    `);
  }

  protected async buildIncremental(since: Date): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO mv_oracle_price_stats
      SELECT
        oracle_id, asset_symbol,
        MIN(price), MAX(price), AVG(price), STDDEV(price), COUNT(*),
        MIN(created_at), MAX(created_at), NOW()
      FROM oracle_price_feeds
      WHERE created_at >= $1
      GROUP BY oracle_id, asset_symbol
      ON CONFLICT (oracle_id, asset_symbol) DO UPDATE
        SET min_price       = LEAST(EXCLUDED.min_price, mv_oracle_price_stats.min_price),
            max_price       = GREATEST(EXCLUDED.max_price, mv_oracle_price_stats.max_price),
            avg_price       = (EXCLUDED.avg_price + mv_oracle_price_stats.avg_price) / 2,
            sample_count    = mv_oracle_price_stats.sample_count + EXCLUDED.sample_count,
            period_end      = GREATEST(EXCLUDED.period_end, mv_oracle_price_stats.period_end),
            last_updated_at = NOW();
    `,
      [since],
    );
  }

  async queryBySymbol(symbol: string): Promise<OraclePriceStats[]> {
    return this.query(`symbol_${symbol}`, async () => {
      const rows = await this.dataSource.query(
        `SELECT * FROM mv_oracle_price_stats WHERE asset_symbol = $1`,
        [symbol],
      );
      return rows.map(this._mapRow);
    });
  }

  private _mapRow(r: Record<string, unknown>): OraclePriceStats {
    return {
      oracleId: r.oracle_id as string,
      assetSymbol: r.asset_symbol as string,
      minPrice: Number(r.min_price),
      maxPrice: Number(r.max_price),
      avgPrice: Number(r.avg_price),
      stdDev: Number(r.std_dev),
      sampleCount: Number(r.sample_count),
      periodStart: new Date(r.period_start as string),
      periodEnd: new Date(r.period_end as string),
      lastUpdatedAt: new Date(r.last_updated_at as string),
    };
  }

  protected async countRows(): Promise<number> {
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) AS count FROM mv_oracle_price_stats`,
    );
    return Number(count);
  }

  protected async estimateSizeBytes(): Promise<number> {
    const [row] = await this.dataSource
      .query(`SELECT pg_total_relation_size('mv_oracle_price_stats') AS size`)
      .catch(() => [{ size: 0 }]);
    return Number(row?.size ?? 0);
  }

  protected async detectCorruption(): Promise<boolean> {
    try {
      await this.dataSource.query(
        `SELECT 1 FROM mv_oracle_price_stats LIMIT 1`,
      );
      return false;
    } catch {
      return true;
    }
  }

  protected async recreateStructures(): Promise<void> {
    await this.dataSource.query(`DROP TABLE IF EXISTS mv_oracle_price_stats`);
  }
}

// ─── AuditSummaryView ─────────────────────────────────────────────────────

@Injectable()
export class AuditSummaryView extends MaterializedView<AuditSummaryEntry> {
  constructor(
    private readonly dataSource: DataSource,
    eventEmitter: EventEmitter2,
  ) {
    // Audit summaries: acceptable staleness 1 hour (3600s)
    super("AuditSummaryView", 3600, RefreshStrategy.BATCH, eventEmitter);
  }

  protected async buildFull(): Promise<void> {
    await this.dataSource.query(`
      DROP TABLE IF EXISTS mv_audit_summary;

      CREATE TABLE mv_audit_summary AS
      SELECT
        entity_type,
        entity_id,
        action_type,
        COUNT(*)                        AS count,
        MIN(created_at)                 AS first_occurrence,
        MAX(created_at)                 AS last_occurrence,
        array_agg(DISTINCT actor_id)    AS actor_ids
      FROM audit_logs
      GROUP BY entity_type, entity_id, action_type;

      CREATE INDEX idx_mv_as_entity     ON mv_audit_summary (entity_type, entity_id);
      CREATE INDEX idx_mv_as_action     ON mv_audit_summary (action_type);
      CREATE INDEX idx_mv_as_last_occ   ON mv_audit_summary (last_occurrence DESC);
    `);
  }

  protected async buildIncremental(since: Date): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO mv_audit_summary (entity_type, entity_id, action_type, count, first_occurrence, last_occurrence, actor_ids)
      SELECT
        entity_type, entity_id, action_type,
        COUNT(*), MIN(created_at), MAX(created_at),
        array_agg(DISTINCT actor_id)
      FROM audit_logs
      WHERE created_at >= $1
      GROUP BY entity_type, entity_id, action_type
      ON CONFLICT (entity_type, entity_id, action_type) DO UPDATE
        SET count            = mv_audit_summary.count + EXCLUDED.count,
            last_occurrence  = GREATEST(mv_audit_summary.last_occurrence, EXCLUDED.last_occurrence),
            actor_ids        = array_cat(mv_audit_summary.actor_ids, EXCLUDED.actor_ids);
    `,
      [since],
    );
  }

  async queryByEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditSummaryEntry[]> {
    return this.query(`entity_${entityType}_${entityId}`, async () => {
      const rows = await this.dataSource.query(
        `SELECT * FROM mv_audit_summary WHERE entity_type = $1 AND entity_id = $2 ORDER BY last_occurrence DESC`,
        [entityType, entityId],
      );
      return rows.map((r: Record<string, unknown>) => ({
        entityType: r.entity_type as string,
        entityId: r.entity_id as string,
        actionType: r.action_type as string,
        count: Number(r.count),
        firstOccurrence: new Date(r.first_occurrence as string),
        lastOccurrence: new Date(r.last_occurrence as string),
        actorIds: r.actor_ids as string[],
      }));
    });
  }

  protected async countRows(): Promise<number> {
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) AS count FROM mv_audit_summary`,
    );
    return Number(count);
  }

  protected async estimateSizeBytes(): Promise<number> {
    const [row] = await this.dataSource
      .query(`SELECT pg_total_relation_size('mv_audit_summary') AS size`)
      .catch(() => [{ size: 0 }]);
    return Number(row?.size ?? 0);
  }

  protected async detectCorruption(): Promise<boolean> {
    try {
      await this.dataSource.query(`SELECT 1 FROM mv_audit_summary LIMIT 1`);
      return false;
    } catch {
      return true;
    }
  }

  protected async recreateStructures(): Promise<void> {
    await this.dataSource.query(`DROP TABLE IF EXISTS mv_audit_summary`);
  }
}
