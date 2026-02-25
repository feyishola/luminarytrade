import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventMonitoringService } from './monitoring.service';
import { NestEventBus } from './nest-event-bus.service';
import { EventStore } from './event-store.service';

@Injectable()
export class EventMetricsCollector {
  private readonly logger = new Logger(EventMetricsCollector.name);

  constructor(
    private readonly monitoringService: EventMonitoringService,
    private readonly eventBus: NestEventBus,
    private readonly eventStore: EventStore,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  collectMetrics(): void {
    try {
      const metrics = this.monitoringService.getAllMetrics();
      const health = this.monitoringService.getHealthStatus();

      this.logger.log(`Event metrics collected: ${metrics.totalEvents} total events`);
      
      if (health.status !== 'healthy') {
        this.logger.warn(`Event system health: ${health.status}`, health.issues);
      }

      // Log top event types
      const topEvents = this.monitoringService.getTopEventTypes(5);
      if (topEvents.length > 0) {
        this.logger.debug(
          `Top event types: ${topEvents.map(e => `${e.eventType} (${e.count})`).join(', ')}`
        );
      }

      // Log slow events
      const slowEvents = this.monitoringService.getSlowEventTypes(3);
      if (slowEvents.length > 0) {
        this.logger.warn(
          `Slow events: ${slowEvents.map(e => `${e.eventType} (${e.averageProcessingTime.toFixed(2)}ms)`).join(', ')}`
        );
      }
    } catch (error) {
      this.logger.error('Failed to collect event metrics:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  exportMetrics(): void {
    try {
      const metrics = this.monitoringService.exportMetrics();
      this.logger.log(`Hourly metrics export: ${metrics}`);
      
      // Here you could send metrics to external monitoring systems
      // like Prometheus, DataDog, CloudWatch, etc.
    } catch (error) {
      this.logger.error('Failed to export metrics:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  resetDailyMetrics(): void {
    try {
      this.monitoringService.resetMetrics();
      this.logger.log('Daily metrics reset completed');
    } catch (error) {
      this.logger.error('Failed to reset daily metrics:', error);
    }
  }
}
