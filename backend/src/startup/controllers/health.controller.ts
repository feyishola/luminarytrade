import { Controller, Get, HttpStatus, HttpCode, Res } from '@nestjs/common';
import { Response } from 'express';
import { StartupService } from '../services/startup.service';
import { DependencyVerificationService } from '../services/dependency-verification.service';
import { DependencyType } from '../enums/startup-phase.enum';

@Controller('health')
export class HealthController {
  constructor(
    private readonly startupService: StartupService,
    private readonly dependencyVerificationService: DependencyVerificationService,
  ) {}

  @Get('startup')
  @HttpCode(HttpStatus.OK)
  async startupProbe(@Res() res: Response) {
    const isReady = this.startupService.isReady();
    
    if (isReady) {
      res.status(HttpStatus.OK).json({
        status: 'healthy',
        message: 'Application has started successfully',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'starting',
        message: 'Application is still starting',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('readiness')
  @HttpCode(HttpStatus.OK)
  async readinessProbe(@Res() res: Response) {
    const isReady = this.startupService.isReady();
    const isShuttingDown = this.startupService.isShuttingDown();
    
    if (isShuttingDown) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'shutting_down',
        message: 'Application is shutting down',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!isReady) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'not_ready',
        message: 'Application dependencies are not ready',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check critical dependencies
    const criticalDeps = [DependencyType.DATABASE, DependencyType.CACHE, DependencyType.CONFIG];
    const dependencyReports = await this.dependencyVerificationService.verifyDependencies(criticalDeps);
    
    const failedDeps = dependencyReports.filter(dep => dep.status === 'FAILED');
    
    if (failedDeps.length > 0) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        message: 'Critical dependencies are not available',
        failedDependencies: failedDeps.map(dep => dep.name),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(HttpStatus.OK).json({
      status: 'ready',
      message: 'Application is ready to serve requests',
      dependencies: dependencyReports.map(dep => ({
        name: dep.name,
        status: dep.status,
        duration: dep.duration,
      })),
      timestamp: new Date().toISOString(),
    });
  }

  @Get('liveness')
  @HttpCode(HttpStatus.OK)
  async livenessProbe(@Res() res: Response) {
    // Liveness probe should be simple - just check if the process is running
    // We don't check dependencies here to avoid false positives during startup
    const isShuttingDown = this.startupService.isShuttingDown();
    
    if (isShuttingDown) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'shutting_down',
        message: 'Application is shutting down',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(HttpStatus.OK).json({
      status: 'alive',
      message: 'Application process is running',
      timestamp: new Date().toISOString(),
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    const isReady = this.startupService.isReady();
    const isShuttingDown = this.startupService.isShuttingDown();
    
    // Get all dependency checks
    const allChecks = this.dependencyVerificationService.getDependencyChecks();
    const dependencyTypes = allChecks.map(check => check.type);
    const dependencyReports = await this.dependencyVerificationService.verifyDependencies(dependencyTypes);
    
    const criticalDeps = dependencyReports.filter(dep => {
      const check = allChecks.find(c => c.type === dep.type);
      return check?.critical;
    });

    const failedCriticalDeps = criticalDeps.filter(dep => dep.status === 'FAILED');
    
    return {
      status: failedCriticalDeps.length > 0 ? 'unhealthy' : (isReady ? 'healthy' : 'starting'),
      ready: isReady,
      shuttingDown: isShuttingDown,
      dependencies: dependencyReports.map(dep => ({
        type: dep.type,
        name: dep.name,
        status: dep.status,
        duration: dep.duration,
        error: dep.error,
        critical: allChecks.find(c => c.type === dep.type)?.critical || false,
      })),
      summary: {
        total: dependencyReports.length,
        healthy: dependencyReports.filter(dep => dep.status === 'COMPLETED').length,
        failed: dependencyReports.filter(dep => dep.status === 'FAILED').length,
        criticalFailed: failedCriticalDeps.length,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
