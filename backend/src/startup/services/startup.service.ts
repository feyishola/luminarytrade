import { Injectable, Logger, OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { StartupValidatorService } from './startup-validator.service';
import { StartupPhase, StartupStatus } from '../enums/startup-phase.enum';
import { StartupReport } from '../interfaces/startup-phase.interface';

@Injectable()
export class StartupService implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(StartupService.name);
  private startupReport?: StartupReport;
  private shutdownInProgress = false;

  constructor(
    private readonly startupValidator: StartupValidatorService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('🔧 Module initialization phase started');
    
    try {
      // Initialize infrastructure and core services
      await this.initializeInfrastructure();
      await this.initializeCoreServices();
      
      this.logger.log('✅ Module initialization completed');
    } catch (error) {
      this.logger.error(`❌ Module initialization failed: ${error.message}`);
      throw error;
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('🚀 Application bootstrap phase started');
    
    try {
      // Execute full startup validation
      this.startupReport = await this.startupValidator.validateStartup();
      
      if (this.startupReport.overallStatus === StartupStatus.COMPLETED) {
        this.logger.log('✅ Application bootstrap completed successfully');
        this.logStartupReport();
      } else {
        this.logger.error('❌ Application bootstrap failed');
        this.logStartupErrors();
        throw new Error('Application startup validation failed');
      }
    } catch (error) {
      this.logger.error(`❌ Application bootstrap failed: ${error.message}`);
      throw error;
    }
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`🔄 Application shutdown started (signal: ${signal || 'unknown'})`);
    this.shutdownInProgress = true;

    try {
      await this.gracefulShutdown();
      this.logger.log('✅ Application shutdown completed gracefully');
    } catch (error) {
      this.logger.error(`❌ Error during shutdown: ${error.message}`);
    }
  }

  private async initializeInfrastructure(): Promise<void> {
    this.logger.log('🏗️  Initializing infrastructure...');
    
    // Phase 1: Infrastructure
    const infraPhase = await this.startupValidator.validatePhase(StartupPhase.INFRASTRUCTURE);
    if (infraPhase.status === StartupStatus.FAILED) {
      throw new Error(`Infrastructure initialization failed: ${infraPhase.errors.join(', ')}`);
    }
  }

  private async initializeCoreServices(): Promise<void> {
    this.logger.log('⚙️  Initializing core services...');
    
    // Phase 2: Core services
    const corePhase = await this.startupValidator.validatePhase(StartupPhase.CORE);
    if (corePhase.status === StartupStatus.FAILED) {
      throw new Error(`Core services initialization failed: ${corePhase.errors.join(', ')}`);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    this.logger.log('🔄 Starting graceful shutdown...');
    
    const shutdownTasks = [
      this.closeDatabaseConnections(),
      this.drainRequestQueues(),
      this.cancelPendingOperations(),
      this.flushLogs(),
    ];

    try {
      await Promise.allSettled(shutdownTasks);
      this.logger.log('✅ All shutdown tasks completed');
    } catch (error) {
      this.logger.error(`❌ Error during shutdown tasks: ${error.message}`);
    }
  }

  private async closeDatabaseConnections(): Promise<void> {
    this.logger.log('🔌 Closing database connections...');
    // Database connection closing would be handled by TypeORM automatically
    // but we can add any additional cleanup here
  }

  private async drainRequestQueues(): Promise<void> {
    this.logger.log('⏳ Draining request queues...');
    // Implement request queue draining logic
    // This would wait for in-progress requests to complete
  }

  private async cancelPendingOperations(): Promise<void> {
    this.logger.log('❌ Canceling pending operations...');
    // Cancel any pending async operations
  }

  private async flushLogs(): Promise<void> {
    this.logger.log('📝 Flushing logs...');
    // Ensure all logs are written before shutdown
  }

  private logStartupReport(): void {
    if (!this.startupReport) return;

    this.logger.log('📊 === STARTUP REPORT ===');
    this.logger.log(`Total Duration: ${this.startupReport.totalDuration}ms`);
    this.logger.log(`Overall Status: ${this.startupReport.overallStatus}`);
    
    this.startupReport.phases.forEach(phase => {
      this.logger.log(`Phase ${phase.phase}: ${phase.status} (${phase.duration}ms)`);
    });

    if (this.startupReport.warnings.length > 0) {
      this.logger.warn(`⚠️  Warnings: ${this.startupReport.warnings.join(', ')}`);
    }
  }

  private logStartupErrors(): void {
    if (!this.startupReport) return;

    this.logger.error('❌ === STARTUP ERRORS ===');
    this.startupReport.errors.forEach(error => {
      this.logger.error(`❌ ${error}`);
    });
  }

  getStartupReport(): StartupReport | undefined {
    return this.startupReport;
  }

  isReady(): boolean {
    return this.startupValidator.isReady();
  }

  isShuttingDown(): boolean {
    return this.shutdownInProgress;
  }

  getMetrics() {
    return this.startupValidator.getMetrics();
  }
}
