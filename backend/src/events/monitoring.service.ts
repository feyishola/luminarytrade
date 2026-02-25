import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '../domain-events/domain-event.base';

export interface EventMetrics {
  eventType: string;
  count: number;
  lastProcessed: Date;
  averageProcessingTime: number;
  errorCount: number;
  successRate: number;
}

export interface SystemMetrics {
  totalEvents: number;
  eventsByType: Record<string, EventMetrics>;
  deadLetterQueueSize: number;
  activeSagas: number;
  eventStoreSize: number;
  snapshotCount: number;
  uptime: number;
}

@Injectable()
export class EventMonitoringService {
  private readonly logger = new Logger(EventMonitoringService.name);
  private readonly metrics = new Map<string, EventMetrics>();
  private readonly processingTimes = new Map<string, number[]>();
  private startTime = Date.now();

  recordEventProcessed(eventType: string, processingTime: number, success: boolean): void {
    const existing = this.metrics.get(eventType) || {
      eventType,
      count: 0,
      lastProcessed: new Date(),
      averageProcessingTime: 0,
      errorCount: 0,
      successRate: 1,
    };

    existing.count++;
    existing.lastProcessed = new Date();

    if (!success) {
      existing.errorCount++;
    }

    // Update processing times
    const times = this.processingTimes.get(eventType) || [];
    times.push(processingTime);
    
    // Keep only last 100 processing times for rolling average
    if (times.length > 100) {
      times.shift();
    }
    
    this.processingTimes.set(eventType, times);
    existing.averageProcessingTime = times.reduce((a, b) => a + b, 0) / times.length;
    existing.successRate = ((existing.count - existing.errorCount) / existing.count) * 100;

    this.metrics.set(eventType, existing);
  }

  recordDeadLetterEvent(eventType: string): void {
    const existing = this.metrics.get(eventType) || {
      eventType,
      count: 0,
      lastProcessed: new Date(),
      averageProcessingTime: 0,
      errorCount: 0,
      successRate: 1,
    };

    existing.errorCount++;
    existing.successRate = ((existing.count - existing.errorCount) / Math.max(existing.count, 1)) * 100;

    this.metrics.set(eventType, existing);
  }

  getMetricsForEventType(eventType: string): EventMetrics | undefined {
    return this.metrics.get(eventType);
  }

  getAllMetrics(): SystemMetrics {
    const totalEvents = Array.from(this.metrics.values()).reduce(
      (total, metric) => total + metric.count,
      0,
    );

    return {
      totalEvents,
      eventsByType: Object.fromEntries(this.metrics),
      deadLetterQueueSize: 0, // This would come from the event bus
      activeSagas: 0, // This would come from the saga manager
      eventStoreSize: 0, // This would come from the event store
      snapshotCount: 0, // This would come from the snapshot service
      uptime: Date.now() - this.startTime,
    };
  }

  getTopEventTypes(limit: number = 10): EventMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getSlowEventTypes(limit: number = 10): EventMetrics[] {
    return Array.from(this.metrics.values())
      .filter(metric => metric.averageProcessingTime > 0)
      .sort((a, b) => b.averageProcessingTime - a.averageProcessingTime)
      .slice(0, limit);
  }

  getErrorProneEventTypes(limit: number = 10): EventMetrics[] {
    return Array.from(this.metrics.values())
      .filter(metric => metric.successRate < 100)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, limit);
  }

  resetMetrics(): void {
    this.metrics.clear();
    this.processingTimes.clear();
    this.startTime = Date.now();
    this.logger.log('Event metrics reset');
  }

  exportMetrics(): string {
    const metrics = this.getAllMetrics();
    return JSON.stringify(metrics, null, 2);
  }

  // Health check based on metrics
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  } {
    const issues: string[] = [];
    const metrics = this.getAllMetrics();

    // Check error rates
    for (const [eventType, metric] of Object.entries(metrics.eventsByType)) {
      if (metric.successRate < 95 && metric.count > 10) {
        issues.push(`High error rate for ${eventType}: ${metric.successRate.toFixed(2)}%`);
      }
    }

    // Check processing times
    for (const [eventType, metric] of Object.entries(metrics.eventsByType)) {
      if (metric.averageProcessingTime > 5000 && metric.count > 5) { // 5 seconds
        issues.push(`Slow processing for ${eventType}: ${metric.averageProcessingTime.toFixed(2)}ms`);
      }
    }

    // Check dead letter queue
    if (metrics.deadLetterQueueSize > 100) {
      issues.push(`Large dead letter queue: ${metrics.deadLetterQueueSize} events`);
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 0) {
      status = issues.length > 5 ? 'critical' : 'warning';
    }

    return { status, issues };
  }
}
