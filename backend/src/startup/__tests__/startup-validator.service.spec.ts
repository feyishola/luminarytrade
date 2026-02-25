import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StartupValidatorService } from '../services/startup-validator.service';
import { DependencyVerificationService } from '../services/dependency-verification.service';
import { StartupPhase, StartupStatus, DependencyType } from '../enums/startup-phase.enum';

describe('StartupValidatorService', () => {
  let service: StartupValidatorService;
  let dependencyVerificationService: DependencyVerificationService;

  const mockDependencyVerificationService = {
    verifyDependencies: jest.fn(),
    getDependencyChecks: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartupValidatorService,
        {
          provide: DependencyVerificationService,
          useValue: mockDependencyVerificationService,
        },
      ],
    }).compile();

    service = module.get<StartupValidatorService>(StartupValidatorService);
    dependencyVerificationService = module.get<DependencyVerificationService>(DependencyVerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateStartup', () => {
    it('should complete all phases successfully', async () => {
      // Mock successful dependency checks
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

      const result = await service.validateStartup();

      expect(result.overallStatus).toBe(StartupStatus.COMPLETED);
      expect(result.phases).toHaveLength(5); // All 5 phases
      expect(result.errors).toHaveLength(0);
      expect(service.isReady()).toBe(true);
    });

    it('should fail on critical dependency failure', async () => {
      // Mock failed critical dependency
      mockDependencyVerificationService.verifyDependencies.mockResolvedValue([
        {
          type: DependencyType.DATABASE,
          name: 'Database Connection',
          status: StartupStatus.FAILED,
          duration: 100,
          error: 'Connection timeout',
        },
      ]);

      mockDependencyVerificationService.getDependencyChecks.mockReturnValue([
        {
          type: DependencyType.DATABASE,
          name: 'Database Connection',
          check: jest.fn(),
          timeout: 10000,
          critical: true,
        },
      ]);

      const result = await service.validateStartup();

      expect(result.overallStatus).toBe(StartupStatus.FAILED);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(service.isReady()).toBe(false);
    });

    it('should continue with non-critical dependency failures', async () => {
      // Mock failed non-critical dependency
      mockDependencyVerificationService.verifyDependencies.mockResolvedValue([
        {
          type: DependencyType.WEBHOOK,
          name: 'Webhook System',
          status: StartupStatus.FAILED,
          duration: 100,
          error: 'Webhook URL not configured',
        },
      ]);

      mockDependencyVerificationService.getDependencyChecks.mockReturnValue([
        {
          type: DependencyType.WEBHOOK,
          name: 'Webhook System',
          check: jest.fn(),
          timeout: 3000,
          critical: false,
        },
      ]);

      const result = await service.validateStartup();

      expect(result.overallStatus).toBe(StartupStatus.COMPLETED);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(service.isReady()).toBe(true);
    });
  });

  describe('validatePhase', () => {
    it('should validate a specific phase', async () => {
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

      const result = await service.validatePhase(StartupPhase.INFRASTRUCTURE);

      expect(result.phase).toBe(StartupPhase.INFRASTRUCTURE);
      expect(result.status).toBe(StartupStatus.COMPLETED);
      expect(result.dependencies).toHaveLength(2); // DB + Cache
    });

    it('should throw error for invalid phase', async () => {
      await expect(service.validatePhase('INVALID' as StartupPhase))
        .rejects.toThrow('No configuration found for phase INVALID');
    });
  });

  describe('getMetrics', () => {
    it('should return startup metrics', async () => {
      mockDependencyVerificationService.verifyDependencies.mockResolvedValue([]);

      await service.validateStartup();
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('startTime');
      expect(metrics).toHaveProperty('endTime');
      expect(metrics).toHaveProperty('totalDuration');
      expect(metrics).toHaveProperty('phaseMetrics');
      expect(metrics).toHaveProperty('dependencyMetrics');
    });
  });

  describe('generateStartupReport', () => {
    it('should generate a readable startup report', () => {
      const report = service.generateStartupReport();

      expect(report).toContain('APPLICATION STARTUP REPORT');
      expect(report).toContain('Start Time:');
      expect(report).toContain('Application Ready:');
      expect(report).toContain('PHASE METRICS');
      expect(report).toContain('DEPENDENCY METRICS');
    });
  });

  describe('getPhaseConfig', () => {
    it('should return phase configuration', () => {
      const config = service.getPhaseConfig(StartupPhase.INFRASTRUCTURE);

      expect(config).toBeDefined();
      expect(config?.phase).toBe(StartupPhase.INFRASTRUCTURE);
      expect(config?.name).toBe('Infrastructure Setup');
      expect(config?.dependencies).toContain(DependencyType.DATABASE);
      expect(config?.dependencies).toContain(DependencyType.CACHE);
    });

    it('should return undefined for invalid phase', () => {
      const config = service.getPhaseConfig('INVALID' as StartupPhase);
      expect(config).toBeUndefined();
    });
  });

  describe('getAllPhaseConfigs', () => {
    it('should return all phase configurations', () => {
      const configs = service.getAllPhaseConfigs();

      expect(configs).toHaveLength(5);
      expect(configs.map(c => c.phase)).toContain(StartupPhase.INFRASTRUCTURE);
      expect(configs.map(c => c.phase)).toContain(StartupPhase.CORE);
      expect(configs.map(c => c.phase)).toContain(StartupPhase.DOMAIN);
      expect(configs.map(c => c.phase)).toContain(StartupPhase.API);
      expect(configs.map(c => c.phase)).toContain(StartupPhase.EXTERNAL);
    });
  });
});
