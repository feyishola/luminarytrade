import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

import { MaterializedViewRefreshScheduler } from "./refresh-scheduler.service";
import { MaterializedViewMonitoringService } from "./monitoring.service";
import { MaterializedViewsController } from "./materialized-view.controller";
import {
  AuditSummaryView,
  OraclePriceStatsView,
  TopAgentsByScoreView,
  UserScoringHistoryView,
} from "./views.definitions";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([]), // add entities if needed
  ],
  controllers: [MaterializedViewsController],
  providers: [
    TopAgentsByScoreView,
    UserScoringHistoryView,
    OraclePriceStatsView,
    AuditSummaryView,
    MaterializedViewRefreshScheduler,
    MaterializedViewMonitoringService,
  ],
  exports: [
    TopAgentsByScoreView,
    UserScoringHistoryView,
    OraclePriceStatsView,
    AuditSummaryView,
    MaterializedViewMonitoringService,
  ],
})
export class MaterializedViewsModule {}
