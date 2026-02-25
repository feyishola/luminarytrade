import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

export enum RefreshStrategy {
  BATCH = "batch",
  EVENT_DRIVEN = "event_driven",
  SCHEDULED = "scheduled",
  INCREMENTAL = "incremental",
}

export enum ViewStatus {
  FRESH = "fresh",
  STALE = "stale",
  REFRESHING = "refreshing",
  CORRUPTED = "corrupted",
  BUILDING = "building",
}

export interface ViewMetadata {
  viewName: string;
  version: number;
  lastRefreshedAt: Date | null;
  refreshDurationMs: number | null;
  rowCount: number;
  sizeBytes: number;
  status: ViewStatus;
  staleness: number; // seconds
  maxAcceptableStaleness: number; // seconds
}

export interface RefreshOptions {
  force?: boolean;
  incremental?: boolean;
  since?: Date;
}

export interface QueryHints {
  useIndex?: string;
  noCache?: boolean;
  maxExecutionTimeMs?: number;
}

export interface ViewStatistics {
  totalRefreshes: number;
  failedRefreshes: number;
  avgRefreshDurationMs: number;
  lastRefreshDurationMs: number | null;
  queryCount: number;
  avgQueryTimeMs: number;
}

/**
 * Abstract base class for all materialized views.
 * Provides refresh lifecycle, versioning, staleness monitoring,
 * and statistics tracking.
 */
export abstract class MaterializedView<T> {
  protected readonly logger: Logger;
  private metadata: ViewMetadata;
  private statistics: ViewStatistics;
  private queryPlanCache = new Map<string, unknown>();
  private refreshLock = false;

  constructor(
    protected readonly viewName: string,
    protected readonly maxAcceptableStaleness: number, // seconds
    protected readonly refreshStrategy: RefreshStrategy,
    protected readonly eventEmitter?: EventEmitter2,
  ) {
    this.logger = new Logger(viewName);
    this.metadata = {
      viewName,
      version: 1,
      lastRefreshedAt: null,
      refreshDurationMs: null,
      rowCount: 0,
      sizeBytes: 0,
      status: ViewStatus.BUILDING,
      staleness: Infinity,
      maxAcceptableStaleness,
    };
    this.statistics = {
      totalRefreshes: 0,
      failedRefreshes: 0,
      avgRefreshDurationMs: 0,
      lastRefreshDurationMs: null,
      queryCount: 0,
      avgQueryTimeMs: 0,
    };
  }

  // ─── Abstract interface ────────────────────────────────────────────────────

  /** Execute full rebuild of the view */
  protected abstract buildFull(): Promise<void>;

  /** Execute incremental update since a given checkpoint */
  protected abstract buildIncremental(since: Date): Promise<void>;

  /** Return current row count for the view */
  protected abstract countRows(): Promise<number>;

  /** Return estimated size in bytes */
  protected abstract estimateSizeBytes(): Promise<number>;

  /** Detect corruption (e.g. checksum mismatch) */
  protected abstract detectCorruption(): Promise<boolean>;

  /** Recreate underlying DB structures (indexes, partitions, etc.) */
  protected abstract recreateStructures(): Promise<void>;

  // ─── Public API ────────────────────────────────────────────────────────────

  async refresh(options: RefreshOptions = {}): Promise<void> {
    if (this.refreshLock && !options.force) {
      this.logger.warn(
        `[${this.viewName}] Refresh already in progress, skipping.`,
      );
      return;
    }

    this.refreshLock = true;
    const start = Date.now();
    this.metadata.status = ViewStatus.REFRESHING;
    this.eventEmitter?.emit("materialized-view.refresh.start", {
      viewName: this.viewName,
    });

    try {
      const useIncremental =
        options.incremental &&
        this.metadata.lastRefreshedAt !== null &&
        this.refreshStrategy === RefreshStrategy.INCREMENTAL;

      if (useIncremental && this.metadata.lastRefreshedAt) {
        const since = options.since ?? this.metadata.lastRefreshedAt;
        this.logger.log(
          `[${this.viewName}] Incremental refresh since ${since.toISOString()}`,
        );
        await this.buildIncremental(since);
      } else {
        this.logger.log(`[${this.viewName}] Full refresh started`);
        await this.buildFull();
      }

      const durationMs = Date.now() - start;
      this.metadata.lastRefreshedAt = new Date();
      this.metadata.refreshDurationMs = durationMs;
      this.metadata.status = ViewStatus.FRESH;
      this.metadata.staleness = 0;
      this.metadata.rowCount = await this.countRows();
      this.metadata.sizeBytes = await this.estimateSizeBytes();
      this.metadata.version += 1;
      this.queryPlanCache.clear(); // invalidate cached plans after refresh

      this._recordRefreshSuccess(durationMs);
      this.eventEmitter?.emit("materialized-view.refresh.complete", {
        viewName: this.viewName,
        durationMs,
        rowCount: this.metadata.rowCount,
      });
      this.logger.log(
        `[${this.viewName}] Refresh complete in ${durationMs}ms, ${this.metadata.rowCount} rows`,
      );
    } catch (err) {
      this.metadata.status = ViewStatus.CORRUPTED;
      this.statistics.failedRefreshes += 1;
      this.eventEmitter?.emit("materialized-view.refresh.failed", {
        viewName: this.viewName,
        error: (err as Error).message,
      });
      this.logger.error(
        `[${this.viewName}] Refresh failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    } finally {
      this.refreshLock = false;
    }
  }

  async query(
    queryKey: string,
    executor: () => Promise<T[]>,
    hints?: QueryHints,
  ): Promise<T[]> {
    const start = Date.now();
    this._updateStaleness();

    if (this.metadata.status === ViewStatus.STALE) {
      this.logger.warn(
        `[${this.viewName}] Query on stale view (staleness: ${this.metadata.staleness}s)`,
      );
    }

    try {
      // Check query plan cache unless bypassed
      if (!hints?.noCache && this.queryPlanCache.has(queryKey)) {
        this.logger.debug(
          `[${this.viewName}] Using cached query plan for: ${queryKey}`,
        );
      }

      const results = await executor();
      const durationMs = Date.now() - start;
      this._recordQuery(durationMs);
      return results;
    } catch (err) {
      this.logger.error(
        `[${this.viewName}] Query failed: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  async checkHealth(): Promise<{ healthy: boolean; reason?: string }> {
    this._updateStaleness();

    if (this.metadata.status === ViewStatus.CORRUPTED) {
      return { healthy: false, reason: "View is corrupted" };
    }

    if (this.metadata.staleness > this.maxAcceptableStaleness) {
      return {
        healthy: false,
        reason: `View is stale (${this.metadata.staleness}s > ${this.maxAcceptableStaleness}s allowed)`,
      };
    }

    const corrupted = await this.detectCorruption();
    if (corrupted) {
      this.metadata.status = ViewStatus.CORRUPTED;
      return {
        healthy: false,
        reason: "Corruption detected during health check",
      };
    }

    return { healthy: true };
  }

  async rebuild(): Promise<void> {
    this.logger.warn(`[${this.viewName}] Full rebuild triggered`);
    await this.recreateStructures();
    await this.refresh({ force: true });
  }

  getMetadata(): Readonly<ViewMetadata> {
    this._updateStaleness();
    return { ...this.metadata };
  }

  getStatistics(): Readonly<ViewStatistics> {
    return { ...this.statistics };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _updateStaleness(): void {
    if (!this.metadata.lastRefreshedAt) {
      this.metadata.staleness = Infinity;
      this.metadata.status = ViewStatus.BUILDING;
      return;
    }
    const seconds =
      (Date.now() - this.metadata.lastRefreshedAt.getTime()) / 1000;
    this.metadata.staleness = seconds;
    if (
      seconds > this.maxAcceptableStaleness &&
      this.metadata.status === ViewStatus.FRESH
    ) {
      this.metadata.status = ViewStatus.STALE;
      this.eventEmitter?.emit("materialized-view.stale", {
        viewName: this.viewName,
        staleness: seconds,
        maxAcceptableStaleness: this.maxAcceptableStaleness,
      });
    }
  }

  private _recordRefreshSuccess(durationMs: number): void {
    this.statistics.totalRefreshes += 1;
    this.statistics.lastRefreshDurationMs = durationMs;
    this.statistics.avgRefreshDurationMs =
      (this.statistics.avgRefreshDurationMs *
        (this.statistics.totalRefreshes - 1) +
        durationMs) /
      this.statistics.totalRefreshes;
  }

  private _recordQuery(durationMs: number): void {
    this.statistics.queryCount += 1;
    this.statistics.avgQueryTimeMs =
      (this.statistics.avgQueryTimeMs * (this.statistics.queryCount - 1) +
        durationMs) /
      this.statistics.queryCount;
  }
}
