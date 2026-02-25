import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DependencyCheck, DependencyReport } from '../interfaces/startup-phase.interface';
import { DependencyType, StartupStatus } from '../enums/startup-phase.enum';

@Injectable()
export class DependencyVerificationService {
  private readonly logger = new Logger(DependencyVerificationService.name);
  private dependencyChecks: Map<DependencyType, DependencyCheck> = new Map();

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.initializeDependencyChecks();
  }

  private initializeDependencyChecks(): void {
    // Database dependency check
    this.dependencyChecks.set(DependencyType.DATABASE, {
      type: DependencyType.DATABASE,
      name: 'Database Connection',
      check: async () => this.checkDatabaseConnection(),
      timeout: 10000,
      critical: true,
    });

    // Cache dependency check (Redis/BullMQ)
    this.dependencyChecks.set(DependencyType.CACHE, {
      type: DependencyType.CACHE,
      name: 'Cache Connection',
      check: async () => this.checkCacheConnection(),
      timeout: 5000,
      critical: true,
    });

    // Configuration dependency check
    this.dependencyChecks.set(DependencyType.CONFIG, {
      type: DependencyType.CONFIG,
      name: 'Configuration Validity',
      check: async () => this.checkConfigurationValidity(),
      timeout: 2000,
      critical: true,
    });

    // Logging dependency check
    this.dependencyChecks.set(DependencyType.LOGGING, {
      type: DependencyType.LOGGING,
      name: 'Logging System',
      check: async () => this.checkLoggingSystem(),
      timeout: 1000,
      critical: false,
    });

    // Agent service dependency check
    this.dependencyChecks.set(DependencyType.AGENT, {
      type: DependencyType.AGENT,
      name: 'Agent Service',
      check: async () => this.checkAgentService(),
      timeout: 5000,
      critical: true,
    });

    // Oracle service dependency check
    this.dependencyChecks.set(DependencyType.ORACLE, {
      type: DependencyType.ORACLE,
      name: 'Oracle Service',
      check: async () => this.checkOracleService(),
      timeout: 5000,
      critical: true,
    });

    // Webhook dependency check
    this.dependencyChecks.set(DependencyType.WEBHOOK, {
      type: DependencyType.WEBHOOK,
      name: 'Webhook System',
      check: async () => this.checkWebhookSystem(),
      timeout: 3000,
      critical: false,
    });

    // External API dependency check
    this.dependencyChecks.set(DependencyType.EXTERNAL_API, {
      type: DependencyType.EXTERNAL_API,
      name: 'External API Connectivity',
      check: async () => this.checkExternalApiConnectivity(),
      timeout: 8000,
      critical: false,
    });
  }

  async verifyDependency(type: DependencyType): Promise<DependencyReport> {
    const check = this.dependencyChecks.get(type);
    if (!check) {
      throw new Error(`No dependency check configured for ${type}`);
    }

    const startTime = Date.now();
    this.logger.log(`Checking dependency: ${check.name}`);

    try {
      const result = await Promise.race([
        check.check(),
        this.timeout(check.timeout),
      ]);

      const duration = Date.now() - startTime;
      
      if (result) {
        this.logger.log(`✅ ${check.name} - OK (${duration}ms)`);
        return {
          type,
          name: check.name,
          status: StartupStatus.COMPLETED,
          duration,
        };
      } else {
        this.logger.error(`❌ ${check.name} - FAILED`);
        return {
          type,
          name: check.name,
          status: StartupStatus.FAILED,
          duration,
          error: 'Dependency check returned false',
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ ${check.name} - ERROR: ${errorMessage}`);
      return {
        type,
        name: check.name,
        status: StartupStatus.FAILED,
        duration,
        error: errorMessage,
      };
    }
  }

  async verifyDependencies(types: DependencyType[]): Promise<DependencyReport[]> {
    const reports: DependencyReport[] = [];
    
    for (const type of types) {
      const report = await this.verifyDependency(type);
      reports.push(report);
      
      // If critical dependency fails, we might want to stop
      const check = this.dependencyChecks.get(type);
      if (check?.critical && report.status === StartupStatus.FAILED) {
        this.logger.error(`Critical dependency ${check.name} failed, stopping verification`);
        break;
      }
    }
    
    return reports;
  }

  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Database connection failed: ${errorMessage}`);
      throw error; // Re-throw to get the actual error message
    }
  }

  private async checkCacheConnection(): Promise<boolean> {
    try {
      // This would typically check Redis/BullMQ connection
      // For now, we'll do a basic check
      const redisHost = this.configService.get<string>('REDIS_HOST');
      const redisPort = this.configService.get<string>('REDIS_PORT');
      
      if (!redisHost || !redisPort) {
        return false;
      }
      
      // In a real implementation, you'd ping Redis here
      return true;
    } catch (error) {
      this.logger.error(`Cache connection failed: ${error.message}`);
      return false;
    }
  }

  private async checkConfigurationValidity(): Promise<boolean> {
    try {
      const requiredEnvVars = [
        'DATABASE_HOST',
        'DATABASE_PORT',
        'DATABASE_NAME',
        'REDIS_HOST',
        'REDIS_PORT',
      ];

      for (const envVar of requiredEnvVars) {
        if (!this.configService.get(envVar)) {
          const error = new Error(`Missing required environment variable: ${envVar}`);
          this.logger.error(`Configuration validation failed: ${error.message}`);
          throw error; // Re-throw to get the actual error message
        }
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Configuration validation failed: ${errorMessage}`);
      throw error; // Re-throw to get the actual error message
    }
  }

  private async checkLoggingSystem(): Promise<boolean> {
    try {
      // Basic check if logger is working
      this.logger.debug('Logging system check');
      return true;
    } catch (error) {
      this.logger.error(`Logging system check failed: ${error.message}`);
      return false;
    }
  }

  private async checkAgentService(): Promise<boolean> {
    try {
      // This would check if the agent service is available
      // For now, we'll assume it's available if the module loads
      return true;
    } catch (error) {
      this.logger.error(`Agent service check failed: ${error.message}`);
      return false;
    }
  }

  private async checkOracleService(): Promise<boolean> {
    try {
      // This would check if the oracle service is available
      // For now, we'll assume it's available if the module loads
      return true;
    } catch (error) {
      this.logger.error(`Oracle service check failed: ${error.message}`);
      return false;
    }
  }

  private async checkWebhookSystem(): Promise<boolean> {
    try {
      // This would check webhook system availability
      const webhookUrl = this.configService.get<string>('WEBHOOK_URL');
      return !!webhookUrl;
    } catch (error) {
      this.logger.error(`Webhook system check failed: ${error.message}`);
      return false;
    }
  }

  private async checkExternalApiConnectivity(): Promise<boolean> {
    try {
      // This would check external API connectivity
      // For now, we'll just check if API URLs are configured
      const apiUrl = this.configService.get<string>('EXTERNAL_API_URL');
      return !!apiUrl;
    } catch (error) {
      this.logger.error(`External API connectivity check failed: ${error.message}`);
      return false;
    }
  }

  private async timeout(ms: number): Promise<boolean> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
  }

  getDependencyChecks(): DependencyCheck[] {
    return Array.from(this.dependencyChecks.values());
  }
}
