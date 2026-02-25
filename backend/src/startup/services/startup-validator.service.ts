import { Injectable, Logger } from '@nestjs/common';
import { 
  StartupPhase, 
  StartupStatus, 
  DependencyType 
} from '../enums/startup-phase.enum';
import { 
  StartupPhaseConfig, 
  StartupReport, 
  PhaseReport, 
  StartupMetrics 
} from '../interfaces/startup-phase.interface';
import { DependencyVerificationService } from './dependency-verification.service';

@Injectable()
export class StartupValidatorService {
  private readonly logger = new Logger(StartupValidatorService.name);
  private readonly phaseConfigs: Map<StartupPhase, StartupPhaseConfig> = new Map();
  private metrics: StartupMetrics;
  private isApplicationReady = false;

  constructor(
    private readonly dependencyVerificationService: DependencyVerificationService,
  ) {
    this.initializePhaseConfigs();
    this.metrics = {
      startTime: new Date(),
      phaseMetrics: new Map(),
      dependencyMetrics: new Map(),
    };
  }

  private initializePhaseConfigs(): void {
    // Phase 1: Infrastructure (Database, Cache)
    this.phaseConfigs.set(StartupPhase.INFRASTRUCTURE, {
      phase: StartupPhase.INFRASTRUCTURE,
      name: 'Infrastructure Setup',
      dependencies: [DependencyType.DATABASE, DependencyType.CACHE],
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 2000,
    });

    // Phase 2: Core services (Config, Logging)
    this.phaseConfigs.set(StartupPhase.CORE, {
      phase: StartupPhase.CORE,
      name: 'Core Services',
      dependencies: [DependencyType.CONFIG, DependencyType.LOGGING],
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
    });

    // Phase 3: Domain services (Agent, Oracle)
    this.phaseConfigs.set(StartupPhase.DOMAIN, {
      phase: StartupPhase.DOMAIN,
      name: 'Domain Services',
      dependencies: [DependencyType.AGENT, DependencyType.ORACLE],
      timeout: 15000,
      retryAttempts: 3,
      retryDelay: 2000,
    });

    // Phase 4: API layer (Controllers, Routes)
    this.phaseConfigs.set(StartupPhase.API, {
      phase: StartupPhase.API,
      name: 'API Layer',
      dependencies: [],
      timeout: 5000,
      retryAttempts: 1,
      retryDelay: 500,
    });

    // Phase 5: External integrations (Webhooks)
    this.phaseConfigs.set(StartupPhase.EXTERNAL, {
      phase: StartupPhase.EXTERNAL,
      name: 'External Integrations',
      dependencies: [DependencyType.WEBHOOK, DependencyType.EXTERNAL_API],
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
    });
  }

  async validateStartup(): Promise<StartupReport> {
    this.logger.log('🚀 Starting application startup validation...');
    const startTime = Date.now();

    const phases: PhaseReport[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let overallStatus = StartupStatus.COMPLETED;

    for (const [phase, config] of this.phaseConfigs) {
      const phaseReport = await this.executePhase(phase, config);
      phases.push(phaseReport);

      if (phaseReport.status === StartupStatus.FAILED) {
        overallStatus = StartupStatus.FAILED;
        errors.push(`Phase ${config.name} failed: ${phaseReport.errors.join(', ')}`);
        break; // Stop on first critical failure
      }

      if (phaseReport.warnings.length > 0) {
        warnings.push(...phaseReport.warnings);
      }
    }

    const totalDuration = Date.now() - startTime;
    this.metrics.endTime = new Date();
    this.metrics.totalDuration = totalDuration;

    if (overallStatus === StartupStatus.COMPLETED) {
      this.isApplicationReady = true;
      this.logger.log(`✅ Startup validation completed successfully in ${totalDuration}ms`);
    } else {
      this.logger.error(`❌ Startup validation failed after ${totalDuration}ms`);
    }

    return {
      totalDuration,
      phases,
      overallStatus,
      errors,
      warnings,
    };
  }

  private async executePhase(
    phase: StartupPhase, 
    config: StartupPhaseConfig
  ): Promise<PhaseReport> {
    this.logger.log(`🔄 Executing phase: ${config.name}`);
    const startTime = Date.now();

    try {
      // Execute dependency checks for this phase
      const dependencyReports = await this.dependencyVerificationService.verifyDependencies(
        config.dependencies
      );

      const errors: string[] = [];
      const warnings: string[] = [];
      let phaseStatus = StartupStatus.COMPLETED;

      // Check for critical failures
      for (const depReport of dependencyReports) {
        if (depReport.status === StartupStatus.FAILED) {
          const check = this.dependencyVerificationService.getDependencyChecks()
            .find(c => c.type === depReport.type);
          
          if (check?.critical) {
            errors.push(`Critical dependency ${depReport.name} failed: ${depReport.error}`);
            phaseStatus = StartupStatus.FAILED;
          } else {
            warnings.push(`Non-critical dependency ${depReport.name} failed: ${depReport.error}`);
          }
        }
      }

      const duration = Date.now() - startTime;
      this.metrics.phaseMetrics.set(phase, duration);

      if (phaseStatus === StartupStatus.COMPLETED) {
        this.logger.log(`✅ Phase ${config.name} completed in ${duration}ms`);
      } else {
        this.logger.error(`❌ Phase ${config.name} failed in ${duration}ms`);
      }

      return {
        phase,
        status: phaseStatus,
        duration,
        dependencies: dependencyReports,
        errors,
        warnings,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Phase ${config.name} encountered error: ${error.message}`);
      
      return {
        phase,
        status: StartupStatus.FAILED,
        duration,
        dependencies: [],
        errors: [error.message],
        warnings: [],
      };
    }
  }

  async validatePhase(phase: StartupPhase): Promise<PhaseReport> {
    const config = this.phaseConfigs.get(phase);
    if (!config) {
      throw new Error(`No configuration found for phase ${phase}`);
    }

    return this.executePhase(phase, config);
  }

  isReady(): boolean {
    return this.isApplicationReady;
  }

  getMetrics(): StartupMetrics {
    return { ...this.metrics };
  }

  getPhaseConfig(phase: StartupPhase): StartupPhaseConfig | undefined {
    return this.phaseConfigs.get(phase);
  }

  getAllPhaseConfigs(): StartupPhaseConfig[] {
    return Array.from(this.phaseConfigs.values());
  }

  generateStartupReport(): string {
    const report = [];
    report.push('=== APPLICATION STARTUP REPORT ===');
    report.push(`Start Time: ${this.metrics.startTime.toISOString()}`);
    
    if (this.metrics.endTime) {
      report.push(`End Time: ${this.metrics.endTime.toISOString()}`);
      report.push(`Total Duration: ${this.metrics.totalDuration}ms`);
    }
    
    report.push(`Application Ready: ${this.isApplicationReady}`);
    report.push('');

    report.push('=== PHASE METRICS ===');
    for (const [phase, duration] of this.metrics.phaseMetrics) {
      report.push(`${phase}: ${duration}ms`);
    }
    
    report.push('');
    report.push('=== DEPENDENCY METRICS ===');
    for (const [depType, duration] of this.metrics.dependencyMetrics) {
      report.push(`${depType}: ${duration}ms`);
    }

    return report.join('\n');
  }
}
