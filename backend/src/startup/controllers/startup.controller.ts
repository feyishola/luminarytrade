import { Controller, Get, HttpStatus, HttpCode } from '@nestjs/common';
import { StartupService } from '../services/startup.service';
import { StartupValidatorService } from '../services/startup-validator.service';
import { StartupReport } from '../interfaces/startup-phase.interface';

@Controller('startup')
export class StartupController {
  constructor(
    private readonly startupService: StartupService,
    private readonly startupValidator: StartupValidatorService,
  ) {}

  @Get('status')
  getStartupStatus() {
    return {
      isReady: this.startupService.isReady(),
      isShuttingDown: this.startupService.isShuttingDown(),
      metrics: this.startupService.getMetrics(),
    };
  }

  @Get('report')
  getStartupReport(): StartupReport | { message: string } {
    const report = this.startupService.getStartupReport();
    if (!report) {
      return { message: 'Startup report not available yet' };
    }
    return report;
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    const isReady = this.startupService.isReady();
    const isShuttingDown = this.startupService.isShuttingDown();
    
    return {
      status: isReady ? 'healthy' : 'starting',
      ready: isReady,
      shuttingDown: isShuttingDown,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  getMetrics() {
    return this.startupValidator.getMetrics();
  }

  @Get('validate')
  async revalidateStartup() {
    try {
      const report = await this.startupValidator.validateStartup();
      return {
        success: report.overallStatus === 'COMPLETED',
        report,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
