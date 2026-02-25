import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { MaterializedViewRefreshScheduler } from "./refresh-scheduler.service";
import {
  MaterializedViewMonitoringService,
  ViewDashboardEntry,
  ViewAlertEvent,
} from "./monitoring.service";

@Controller("admin/materialized-views")
export class MaterializedViewsController {
  constructor(
    private readonly scheduler: MaterializedViewRefreshScheduler,
    private readonly monitoring: MaterializedViewMonitoringService,
  ) {}

  /** GET /admin/materialized-views
   *  Full dashboard with health, staleness, stats for all views */
  @Get()
  async getDashboard(): Promise<{ views: ViewDashboardEntry[] }> {
    const views = await this.monitoring.getDashboard();
    return { views };
  }

  /** GET /admin/materialized-views/alerts
   *  Recent alert history */
  @Get("alerts")
  getAlerts(): { alerts: ViewAlertEvent[] } {
    return { alerts: this.monitoring.getAlerts() };
  }

  /** POST /admin/materialized-views/:viewName/refresh
   *  Trigger a manual full refresh */
  @Post(":viewName/refresh")
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerRefresh(
    @Param("viewName") viewName: string,
  ): Promise<{ status: string }> {
    try {
      await this.scheduler.triggerRefresh(viewName);
      return { status: "refresh_triggered" };
    } catch (err) {
      if ((err as Error).message.startsWith("Unknown view")) {
        throw new NotFoundException(`View '${viewName}' not found`);
      }
      throw err;
    }
  }

  /** POST /admin/materialized-views/:viewName/rebuild
   *  Drop and fully rebuild a view */
  @Post(":viewName/rebuild")
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerRebuild(
    @Param("viewName") viewName: string,
  ): Promise<{ status: string }> {
    try {
      await this.scheduler.rebuildView(viewName);
      return { status: "rebuild_triggered" };
    } catch (err) {
      if ((err as Error).message.startsWith("Unknown view")) {
        throw new NotFoundException(`View '${viewName}' not found`);
      }
      throw err;
    }
  }
}
