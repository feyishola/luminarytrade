import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../controllers/health.controller';
import { StartupService } from '../services/startup.service';
import { DependencyVerificationService } from '../services/dependency-verification.service';
import { Response } from 'express';
import { DependencyType, StartupStatus } from '../enums/startup-phase.enum';

describe('HealthController', () => {
  let controller: HealthController;
  let mockStartupService: jest.Mocked<StartupService>;
  let mockDependencyVerificationService: jest.Mocked<DependencyVerificationService>;
  let mockResponse: jest.Mocked<Response>;

  beforeEach(async () => {
    mockStartupService = {
      isReady: jest.fn(),
      isShuttingDown: jest.fn(),
    } as any;

    mockDependencyVerificationService = {
      verifyDependencies: jest.fn(),
      getDependencyChecks: jest.fn(),
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: StartupService,
          useValue: mockStartupService,
        },
        {
          provide: DependencyVerificationService,
          useValue: mockDependencyVerificationService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startupProbe', () => {
    it('should return 200 when application is ready', async () => {
      mockStartupService.isReady.mockReturnValue(true);

      await controller.startupProbe(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'healthy',
        message: 'Application has started successfully',
        timestamp: expect.any(String),
      });
    });

    it('should return 503 when application is not ready', async () => {
      mockStartupService.isReady.mockReturnValue(false);

      await controller.startupProbe(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'starting',
        message: 'Application is still starting',
        timestamp: expect.any(String),
      });
    });
  });

  describe('readinessProbe', () => {
    beforeEach(() => {
      mockDependencyVerificationService.getDependencyChecks.mockReturnValue([
        {
          type: DependencyType.DATABASE,
          name: 'Database Connection',
          check: jest.fn(),
          timeout: 10000,
          critical: true,
        },
        {
          type: DependencyType.CACHE,
          name: 'Cache Connection',
          check: jest.fn(),
          timeout: 5000,
          critical: true,
        },
      ]);
    });

    it('should return 200 when application is ready and dependencies are healthy', async () => {
      mockStartupService.isReady.mockReturnValue(true);
      mockStartupService.isShuttingDown.mockReturnValue(false);
      mockDependencyVerificationService.verifyDependencies.mockResolvedValue([
        {
          type: DependencyType.DATABASE,
          name: 'Database Connection',
          status: StartupStatus.COMPLETED,
          duration: 100,
        },
        {
          type: DependencyType.CACHE,
          name: 'Cache Connection',
          status: StartupStatus.COMPLETED,
          duration: 50,
        },
      ]);

      await controller.readinessProbe(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'ready',
        message: 'Application is ready to serve requests',
        dependencies: [
          {
            name: 'Database Connection',
            status: 'COMPLETED',
            duration: 100,
          },
          {
            name: 'Cache Connection',
            status: 'COMPLETED',
            duration: 50,
          },
        ],
        timestamp: expect.any(String),
      });
    });

    it('should return 503 when application is shutting down', async () => {
      mockStartupService.isShuttingDown.mockReturnValue(true);

      await controller.readinessProbe(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'shutting_down',
        message: 'Application is shutting down',
        timestamp: expect.any(String),
      });
    });

    it('should return 503 when application is not ready', async () => {
      mockStartupService.isReady.mockReturnValue(false);
      mockStartupService.isShuttingDown.mockReturnValue(false);

      await controller.readinessProbe(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'not_ready',
        message: 'Application dependencies are not ready',
        timestamp: expect.any(String),
      });
    });

    it('should return 503 when critical dependencies fail', async () => {
      mockStartupService.isReady.mockReturnValue(true);
      mockStartupService.isShuttingDown.mockReturnValue(false);
      mockDependencyVerificationService.verifyDependencies.mockResolvedValue([
        {
          type: DependencyType.DATABASE,
          name: 'Database Connection',
          status: StartupStatus.FAILED,
          duration: 100,
          error: 'Connection timeout',
        },
      ]);

      await controller.readinessProbe(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'unhealthy',
        message: 'Critical dependencies are not available',
        failedDependencies: ['Database Connection'],
        timestamp: expect.any(String),
      });
    });
  });

  describe('livenessProbe', () => {
    it('should return 200 when application is running', async () => {
      mockStartupService.isShuttingDown.mockReturnValue(false);

      await controller.livenessProbe(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'alive',
        message: 'Application process is running',
        timestamp: expect.any(String),
      });
    });

    it('should return 503 when application is shutting down', async () => {
      mockStartupService.isShuttingDown.mockReturnValue(true);

      await controller.livenessProbe(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'shutting_down',
        message: 'Application is shutting down',
        timestamp: expect.any(String),
      });
    });
  });

  describe('healthCheck', () => {
    beforeEach(() => {
      mockDependencyVerificationService.getDependencyChecks.mockReturnValue([
        {
          type: DependencyType.DATABASE,
          name: 'Database Connection',
          check: jest.fn(),
          timeout: 10000,
          critical: true,
        },
        {
          type: DependencyType.WEBHOOK,
          name: 'Webhook System',
          check: jest.fn(),
          timeout: 3000,
          critical: false,
        },
      ]);
    });

    it('should return healthy status when all critical dependencies are ready', async () => {
      mockStartupService.isReady.mockReturnValue(true);
      mockStartupService.isShuttingDown.mockReturnValue(false);
      mockDependencyVerificationService.verifyDependencies.mockResolvedValue([
        {
          type: DependencyType.DATABASE,
          name: 'Database Connection',
          status: StartupStatus.COMPLETED,
          duration: 100,
        },
        {
          type: DependencyType.WEBHOOK,
          name: 'Webhook System',
          status: StartupStatus.FAILED,
          duration: 50,
          error: 'Not configured',
        },
      ]);

      const result = await controller.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.ready).toBe(true);
      expect(result.shuttingDown).toBe(false);
      expect(result.summary.total).toBe(2);
      expect(result.summary.healthy).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.summary.criticalFailed).toBe(0);
    });

    it('should return starting status when application is not ready', async () => {
      mockStartupService.isReady.mockReturnValue(false);
      mockStartupService.isShuttingDown.mockReturnValue(false);
      mockDependencyVerificationService.verifyDependencies.mockResolvedValue([]);

      const result = await controller.healthCheck();

      expect(result.status).toBe('starting');
      expect(result.ready).toBe(false);
    });

    it('should return unhealthy status when critical dependencies fail', async () => {
      mockStartupService.isReady.mockReturnValue(true);
      mockStartupService.isShuttingDown.mockReturnValue(false);
      mockDependencyVerificationService.verifyDependencies.mockResolvedValue([
        {
          type: DependencyType.DATABASE,
          name: 'Database Connection',
          status: StartupStatus.FAILED,
          duration: 100,
          error: 'Connection timeout',
        },
      ]);

      const result = await controller.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.summary.criticalFailed).toBe(1);
    });

    it('should include dependency details in response', async () => {
      mockStartupService.isReady.mockReturnValue(true);
      mockStartupService.isShuttingDown.mockReturnValue(false);
      mockDependencyVerificationService.verifyDependencies.mockResolvedValue([
        {
          type: DependencyType.DATABASE,
          name: 'Database Connection',
          status: StartupStatus.COMPLETED,
          duration: 100,
        },
      ]);

      const result = await controller.healthCheck();

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]).toEqual({
        type: DependencyType.DATABASE,
        name: 'Database Connection',
        status: StartupStatus.COMPLETED,
        duration: 100,
        error: undefined,
        critical: true,
      });
    });
  });
});
