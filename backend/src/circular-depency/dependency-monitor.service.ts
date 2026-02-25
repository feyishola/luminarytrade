import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleGraphAnalyzer } from '../circular-dependency/module-graph.analyzer';

export interface LazyInitMetric {
  token: string;
  resolvedAt: Date;
  resolutionTimeMs: number;
  callCount: number;
}

export interface DependencyResolutionMetric {
  moduleName: string;
  resolutionTimeMs: number;
  timestamp: Date;
}

export interface MonitoringOptions {
  /** Directory to scan for modules */
  srcDir?: string;
  /** Alert threshold in ms for lazy initialization */
  lazyInitThresholdMs?: number;
  /** Whether to emit console alerts */
  alertsEnabled?: boolean;
  /** Whether to scan on module init */
  scanOnInit?: boolean;
}

@Injectable()
export class DependencyMonitorService implements OnModuleInit {
  private readonly logger = new Logger(DependencyMonitorService.name);

  private lazyMetrics: Map<string, LazyInitMetric> = new Map();
  private resolutionMetrics: DependencyResolutionMetric[] = [];
  private circularDepCount = 0;

  constructor(
    private readonly analyzer: ModuleGraphAnalyzer,
    private readonly options: MonitoringOptions = {},
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.options.scanOnInit && this.options.srcDir) {
      await this.runAudit(this.options.srcDir);
    }
  }

  /**
   * Records a lazy initialization event with timing.
   */
  recordLazyInit(token: string, startTime: [number, number]): void {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const ms = seconds * 1000 + nanoseconds / 1_000_000;

    const existing = this.lazyMetrics.get(token);
    if (existing) {
      existing.callCount++;
      existing.resolutionTimeMs = (existing.resolutionTimeMs + ms) / 2; // rolling avg
    } else {
      this.lazyMetrics.set(token, {
        token,
        resolvedAt: new Date(),
        resolutionTimeMs: ms,
        callCount: 1,
      });
    }

    const threshold = this.options.lazyInitThresholdMs ?? 50;
    if (ms > threshold && this.options.alertsEnabled !== false) {
      this.logger.warn(
        `[PERF ALERT] Lazy initialization of "${token}" took ${ms.toFixed(2)}ms ` +
        `(threshold: ${threshold}ms)`,
      );
    }
  }

  /**
   * Records module resolution timing.
   */
  recordResolution(moduleName: string, startTime: [number, number]): void {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const ms = seconds * 1000 + nanoseconds / 1_000_000;

    this.resolutionMetrics.push({
      moduleName,
      resolutionTimeMs: ms,
      timestamp: new Date(),
    });

    // Keep only the last 1000 entries
    if (this.resolutionMetrics.length > 1000) {
      this.resolutionMetrics.shift();
    }
  }

  /**
   * Runs a full dependency audit and alerts on new circular deps.
   */
  async runAudit(srcDir: string): Promise<void> {
    this.logger.log('Running circular dependency audit...');

    await this.analyzer.buildGraphFromDirectory(srcDir);
    const report = this.analyzer.generateReport();

    const newCircularCount = report.circularChains.length;

    if (newCircularCount > this.circularDepCount) {
      const newCount = newCircularCount - this.circularDepCount;
      this.logger.error(
        `[CIRCULAR DEP ALERT] ${newCount} new circular dependency chain(s) detected! ` +
        `Total: ${newCircularCount}`,
      );

      for (const chain of report.circularChains) {
        this.logger.error(
          `  Chain: ${chain.chain.join(' → ')} [${chain.severity}] ` +
          `— Suggested fix: ${chain.suggestion}`,
        );
      }
    } else if (newCircularCount === 0) {
      this.logger.log('✓ No circular dependencies detected.');
    }

    this.circularDepCount = newCircularCount;
  }

  /**
   * Returns aggregated monitoring metrics.
   */
  getMetricsSummary() {
    const totalLazyInits = [...this.lazyMetrics.values()].reduce(
      (acc, m) => acc + m.callCount,
      0,
    );
    const avgLazyInitMs =
      this.lazyMetrics.size > 0
        ? [...this.lazyMetrics.values()].reduce((acc, m) => acc + m.resolutionTimeMs, 0) /
          this.lazyMetrics.size
        : 0;

    const avgResolutionMs =
      this.resolutionMetrics.length > 0
        ? this.resolutionMetrics.reduce((acc, m) => acc + m.resolutionTimeMs, 0) /
          this.resolutionMetrics.length
        : 0;

    return {
      circularDependencies: this.circularDepCount,
      lazyProviders: {
        registered: this.lazyMetrics.size,
        totalInitializations: totalLazyInits,
        avgResolutionMs: parseFloat(avgLazyInitMs.toFixed(3)),
        details: [...this.lazyMetrics.values()],
      },
      moduleResolution: {
        recorded: this.resolutionMetrics.length,
        avgResolutionMs: parseFloat(avgResolutionMs.toFixed(3)),
      },
    };
  }
}
