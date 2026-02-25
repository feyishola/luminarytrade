import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import {
  ViewMetadata,
  ViewStatistics,
  ViewStatus,
} from "./materialized-view.base";
import {
  AuditSummaryView,
  OraclePriceStatsView,
  TopAgentsByScoreView,
  UserScoringHistoryView,
} from "./views.definitions";

export interface ViewDashboardEntry {
  viewName: string;
  status: ViewStatus;
  stalenessSeconds: number;
  maxAcceptableStaleness: number;
  rowCount: number;
  sizeBytes: number;
  lastRefreshedAt: Date | null;
  refreshDurationMs: number | null;
  version: number;
  statistics: ViewStatistics;
  healthy: boolean;
  healthReason?: string;
}

export interface ViewAlertEvent {
  viewName: string;
  alertType: "stale" | "refresh_failed" | "corrupted";
  message: string;
  metadata: Partial<ViewMetadata>;
  timestamp: Date;
}

/**
 * Monitors all materialized views, emits alerts on issues,
 * and exposes an in-memory dashboard of view health.
 */
@Injectable()
export class MaterializedViewMonitoringService {
  private readonly logger = new Logger(MaterializedViewMonitoringService.name);
  private readonly alerts: ViewAlertEvent[] = [];
  private readonly MAX_ALERT_HISTORY = 500;

  constructor(
    private readonly topAgentsView: TopAgentsByScoreView,
    private readonly userHistoryView: UserScoringHistoryView,
    private readonly oraclePriceView: OraclePriceStatsView,
    private readonly auditSummaryView: AuditSummaryView,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Periodic health check ─────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAllViews(): Promise<void> {
    const views = this._allViews();
    await Promise.all(
      views.map(async (v) => {
        const health = await v.checkHealth();
        if (!health.healthy) {
          this.logger.warn(
            `[${v.getMetadata().viewName}] Unhealthy: ${health.reason}`,
          );
        }
      }),
    );
  }

  // ─── Alert listeners ────────────────────────────────────────────────────

  @OnEvent("materialized-view.stale")
  onStaleView(payload: {
    viewName: string;
    staleness: number;
    maxAcceptableStaleness: number;
  }): void {
    const alert: ViewAlertEvent = {
      viewName: payload.viewName,
      alertType: "stale",
      message: `View stale: ${payload.staleness.toFixed(0)}s > ${payload.maxAcceptableStaleness}s allowed`,
      metadata: { viewName: payload.viewName, staleness: payload.staleness },
      timestamp: new Date(),
    };
    this._addAlert(alert);
    this.logger.warn(`ALERT stale view: ${alert.message}`);
  }

  @OnEvent("materialized-view.refresh.failed")
  onRefreshFailed(payload: { viewName: string; error: string }): void {
    const alert: ViewAlertEvent = {
      viewName: payload.viewName,
      alertType: "refresh_failed",
      message: `Refresh failed: ${payload.error}`,
      metadata: { viewName: payload.viewName },
      timestamp: new Date(),
    };
    this._addAlert(alert);
    this.logger.error(`ALERT refresh failed: ${alert.message}`);
  }

  @OnEvent("materialized-view.refresh.complete")
  onRefreshComplete(payload: {
    viewName: string;
    durationMs: number;
    rowCount: number;
  }): void {
    this.logger.log(
      `[${payload.viewName}] Refreshed: ${payload.rowCount} rows in ${payload.durationMs}ms`,
    );
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────

  async getDashboard(): Promise<ViewDashboardEntry[]> {
    const views = this._allViews();
    return Promise.all(
      views.map(async (v) => {
        const meta = v.getMetadata();
        const stats = v.getStatistics();
        const health = await v.checkHealth();
        return {
          viewName: meta.viewName,
          status: meta.status,
          stalenessSeconds: meta.staleness,
          maxAcceptableStaleness: meta.maxAcceptableStaleness,
          rowCount: meta.rowCount,
          sizeBytes: meta.sizeBytes,
          lastRefreshedAt: meta.lastRefreshedAt,
          refreshDurationMs: meta.refreshDurationMs,
          version: meta.version,
          statistics: stats,
          healthy: health.healthy,
          healthReason: health.reason,
        } satisfies ViewDashboardEntry;
      }),
    );
  }

  getAlerts(limit = 50): ViewAlertEvent[] {
    return this.alerts.slice(-limit).reverse();
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private _addAlert(alert: ViewAlertEvent): void {
    this.alerts.push(alert);
    if (this.alerts.length > this.MAX_ALERT_HISTORY) {
      this.alerts.shift();
    }
  }

  private _allViews() {
    return [
      this.topAgentsView,
      this.userHistoryView,
      this.oraclePriceView,
      this.auditSummaryView,
    ];
  }
}
