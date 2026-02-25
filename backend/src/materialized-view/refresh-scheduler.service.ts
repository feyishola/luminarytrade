import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MaterializedView, RefreshStrategy } from "./materialized-view.base";
import {
  AuditSummaryView,
  OraclePriceStatsView,
  TopAgentsByScoreView,
  UserScoringHistoryView,
} from "./views.definitions";

export interface RefreshSchedulerConfig {
  batchCron?: string; // default: '0 2 * * *' (2am nightly)
  oraclePriceIntervalMs?: number; // default: 30_000 (30s)
}

/**
 * Orchestrates all refresh strategies:
 *  - Batch (nightly cron)
 *  - Scheduled (interval-based for time-sensitive views)
 *  - Event-driven (triggered by mutation events)
 *  - Manual / forced via `triggerRefresh()`
 */
@Injectable()
export class MaterializedViewRefreshScheduler implements OnModuleInit {
  private readonly logger = new Logger(MaterializedViewRefreshScheduler.name);
  private oraclePriceTimer?: NodeJS.Timeout;

  constructor(
    private readonly topAgentsView: TopAgentsByScoreView,
    private readonly userHistoryView: UserScoringHistoryView,
    private readonly oraclePriceView: OraclePriceStatsView,
    private readonly auditSummaryView: AuditSummaryView,
    private readonly config: RefreshSchedulerConfig = {},
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log("Initializing materialized views...");

    // Initial build – run in parallel where possible
    await Promise.allSettled([
      this.topAgentsView.refresh(),
      this.userHistoryView.refresh(),
      this.oraclePriceView.refresh(),
      this.auditSummaryView.refresh(),
    ]);

    // Start scheduled oracle price refresh
    const interval = this.config.oraclePriceIntervalMs ?? 30_000;
    this.oraclePriceTimer = setInterval(() => {
      this.oraclePriceView
        .refresh({ incremental: true })
        .catch((err) =>
          this.logger.error("Oracle price scheduled refresh failed", err),
        );
    }, interval);

    this.logger.log("Materialized view initialization complete");
  }

  // ─── Batch strategy: nightly low-traffic window ────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async batchNightlyRefresh(): Promise<void> {
    this.logger.log("Batch nightly refresh started");
    // Sequential to reduce DB pressure during batch window
    for (const view of [
      this.auditSummaryView,
      this.topAgentsView,
      this.userHistoryView,
    ]) {
      await view
        .refresh({ force: true })
        .catch((err) =>
          this.logger.error(`Batch refresh failed for view`, err),
        );
    }
  }

  // ─── Scheduled strategy: every 5 min for agent scores ─────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledTopAgentsRefresh(): Promise<void> {
    await this.topAgentsView
      .refresh({ incremental: true })
      .catch((err) =>
        this.logger.error("Top agents scheduled refresh failed", err),
      );
  }

  // ─── Event-driven strategy ─────────────────────────────────────────────

  @OnEvent("score.created")
  @OnEvent("score.updated")
  async onScoreMutation(event: {
    userId: string;
    agentId: string;
    createdAt: Date;
  }): Promise<void> {
    this.logger.debug(
      `score mutation event – refreshing user history for ${event.userId}`,
    );
    await Promise.allSettled([
      this.userHistoryView.refresh({
        incremental: true,
        since: event.createdAt,
      }),
      this.topAgentsView.refresh({ incremental: true, since: event.createdAt }),
    ]);
  }

  @OnEvent("oracle.price.updated")
  async onOraclePriceUpdate(event: { updatedAt: Date }): Promise<void> {
    await this.oraclePriceView
      .refresh({ incremental: true, since: event.updatedAt })
      .catch((err) =>
        this.logger.error("Oracle price event-driven refresh failed", err),
      );
  }

  @OnEvent("audit.log.created")
  async onAuditLogCreated(event: { createdAt: Date }): Promise<void> {
    await this.auditSummaryView
      .refresh({ incremental: true, since: event.createdAt })
      .catch((err) =>
        this.logger.error("Audit summary event-driven refresh failed", err),
      );
  }

  // ─── Manual triggers ────────────────────────────────────────────────────

  async triggerRefresh(viewName: string): Promise<void> {
    const view = this._resolveView(viewName);
    if (!view) {
      throw new Error(`Unknown view: ${viewName}`);
    }
    this.logger.warn(`Manual refresh triggered for ${viewName}`);
    await view.refresh({ force: true });
  }

  async rebuildView(viewName: string): Promise<void> {
    const view = this._resolveView(viewName);
    if (!view) {
      throw new Error(`Unknown view: ${viewName}`);
    }
    this.logger.warn(`Manual rebuild triggered for ${viewName}`);
    await view.rebuild();
  }

  private _resolveView(name: string): MaterializedView<unknown> | undefined {
    const map: Record<string, MaterializedView<unknown>> = {
      TopAgentsByScoreView: this.topAgentsView,
      UserScoringHistoryView: this.userHistoryView,
      OraclePriceStatsView: this.oraclePriceView,
      AuditSummaryView: this.auditSummaryView,
    };
    return map[name];
  }

  onModuleDestroy(): void {
    if (this.oraclePriceTimer) {
      clearInterval(this.oraclePriceTimer);
    }
  }
}
