import { Test, TestingModule } from '@nestjs/testing';
import { StartupService } from '../services/startup.service';
import { StartupValidatorService } from '../services/startup-validator.service';
import { StartupPhase, StartupStatus } from '../enums/startup-phase.enum';
import { StartupReport } from '../interfaces/startup-phase.interface';

describe('StartupService', () => {
  let service: StartupService;
  let mockStartupValidator: jest.Mocked<StartupValidatorService>;

  const mockStartupReport: StartupReport = {
    totalDuration: 1000,
    phases: [
      {
        phase: StartupPhase.INFRASTRUCTURE,
        status: StartupStatus.COMPLETED,
        duration: 500,
        dependencies: [],
        errors: [],
        warnings: [],
      },
      {
        phase: StartupPhase.CORE,
        status: StartupStatus.COMPLETED,
        duration: 300,
        dependencies: [],
        errors: [],
        warnings: [],
      },
      {
        phase: StartupPhase.DOMAIN,
        status: StartupStatus.COMPLETED,
        duration: 200,
        dependencies: [],
        errors: [],
        warnings: [],
      },
      {
        phase: StartupPhase.API,
        status: StartupStatus.COMPLETED,
        duration: 0,
        dependencies: [],
        errors: [],
        warnings: [],
      },
      {
        phase: StartupPhase.EXTERNAL,
        status: StartupStatus.COMPLETED,
        duration: 0,
        dependencies: [],
        errors: [],
        warnings: [],
      },
    ],
    overallStatus: StartupStatus.COMPLETED,
    errors: [],
    warnings: [],
  };

  beforeEach(async () => {
    mockStartupValidator = {
      validateStartup: jest.fn(),
      validatePhase: jest.fn(),
      isReady: jest.fn(),
      getMetrics: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartupService,
        {
          provide: StartupValidatorService,
          useValue: mockStartupValidator,
        },
      ],
    }).compile();

    service = module.get<StartupService>(StartupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize infrastructure and core services successfully', async () => {
      mockStartupValidator.validatePhase
        .mockResolvedValueOnce({
          phase: StartupPhase.INFRASTRUCTURE,
          status: StartupStatus.COMPLETED,
          duration: 500,
          dependencies: [],
          errors: [],
          warnings: [],
        })
        .mockResolvedValueOnce({
          phase: StartupPhase.CORE,
          status: StartupStatus.COMPLETED,
          duration: 300,
          dependencies: [],
          errors: [],
          warnings: [],
        });

      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(mockStartupValidator.validatePhase).toHaveBeenCalledWith(StartupPhase.INFRASTRUCTURE);
      expect(mockStartupValidator.validatePhase).toHaveBeenCalledWith(StartupPhase.CORE);
    });

    it('should throw error if infrastructure initialization fails', async () => {
      mockStartupValidator.validatePhase.mockResolvedValueOnce({
        phase: StartupPhase.INFRASTRUCTURE,
        status: StartupStatus.FAILED,
        duration: 500,
        dependencies: [],
        errors: ['Database connection failed'],
        warnings: [],
      });

      await expect(service.onModuleInit()).rejects.toThrow('Infrastructure initialization failed');
    });

    it('should throw error if core services initialization fails', async () => {
      mockStartupValidator.validatePhase
        .mockResolvedValueOnce({
          phase: StartupPhase.INFRASTRUCTURE,
          status: StartupStatus.COMPLETED,
          duration: 500,
          dependencies: [],
          errors: [],
          warnings: [],
        })
        .mockResolvedValueOnce({
          phase: StartupPhase.CORE,
          status: StartupStatus.FAILED,
          duration: 300,
          dependencies: [],
          errors: ['Configuration validation failed'],
          warnings: [],
        });

      await expect(service.onModuleInit()).rejects.toThrow('Core services initialization failed');
    });
  });

  describe('onApplicationBootstrap', () => {
    it('should complete bootstrap successfully', async () => {
      mockStartupValidator.validateStartup.mockResolvedValue(mockStartupReport);
      mockStartupValidator.isReady.mockReturnValue(true);

      await expect(service.onApplicationBootstrap()).resolves.not.toThrow();
      expect(mockStartupValidator.validateStartup).toHaveBeenCalled();
      expect(service.getStartupReport()).toEqual(mockStartupReport);
    });

    it('should throw error if bootstrap fails', async () => {
      const failedReport: StartupReport = {
        ...mockStartupReport,
        overallStatus: StartupStatus.FAILED,
        errors: ['Critical dependency failed'],
      };

      mockStartupValidator.validateStartup.mockResolvedValue(failedReport);

      await expect(service.onApplicationBootstrap()).rejects.toThrow('Application startup validation failed');
    });
  });

  describe('onApplicationShutdown', () => {
    it('should handle shutdown gracefully', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await service.onApplicationShutdown('SIGTERM');

      expect(service.isShuttingDown()).toBe(true);
      
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle shutdown errors gracefully', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock a shutdown task that fails
      jest.spyOn(service as any, 'gracefulShutdown').mockRejectedValue(new Error('Database error'));
      
      await service.onApplicationShutdown('SIGTERM');

      expect(service.isShuttingDown()).toBe(true);
      
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getStartupReport', () => {
    it('should return undefined if no report exists', () => {
      const report = service.getStartupReport();
      expect(report).toBeUndefined();
    });

    it('should return the startup report', async () => {
      mockStartupValidator.validateStartup.mockResolvedValue(mockStartupReport);
      await service.onApplicationBootstrap();

      const report = service.getStartupReport();
      expect(report).toEqual(mockStartupReport);
    });
  });

  describe('isReady', () => {
    it('should return validator ready status', () => {
      mockStartupValidator.isReady.mockReturnValue(true);
      expect(service.isReady()).toBe(true);

      mockStartupValidator.isReady.mockReturnValue(false);
      expect(service.isReady()).toBe(false);
    });
  });

  describe('isShuttingDown', () => {
    it('should return false initially', () => {
      expect(service.isShuttingDown()).toBe(false);
    });

    it('should return true after shutdown starts', async () => {
      await service.onApplicationShutdown('SIGTERM');
      expect(service.isShuttingDown()).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should return validator metrics', () => {
      const mockMetrics = {
        startTime: new Date(),
        endTime: new Date(),
        totalDuration: 1000,
        phaseMetrics: new Map(),
        dependencyMetrics: new Map(),
      };

      mockStartupValidator.getMetrics.mockReturnValue(mockMetrics);
      expect(service.getMetrics()).toEqual(mockMetrics);
    });
  });

  describe('graceful shutdown tasks', () => {
    it('should execute all shutdown tasks', async () => {
      const closeDbSpy = jest.spyOn(service as any, 'closeDatabaseConnections').mockResolvedValue(undefined);
      const drainQueueSpy = jest.spyOn(service as any, 'drainRequestQueues').mockResolvedValue(undefined);
      const cancelOpsSpy = jest.spyOn(service as any, 'cancelPendingOperations').mockResolvedValue(undefined);
      const flushLogsSpy = jest.spyOn(service as any, 'flushLogs').mockResolvedValue(undefined);

      await service.onApplicationShutdown('SIGTERM');

      expect(closeDbSpy).toHaveBeenCalled();
      expect(drainQueueSpy).toHaveBeenCalled();
      expect(cancelOpsSpy).toHaveBeenCalled();
      expect(flushLogsSpy).toHaveBeenCalled();
    });
  });
});
