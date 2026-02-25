import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DependencyVerificationService } from '../services/dependency-verification.service';
import { DependencyType, StartupStatus } from '../enums/startup-phase.enum';

describe('DependencyVerificationService', () => {
  let service: DependencyVerificationService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependencyVerificationService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DependencyVerificationService>(DependencyVerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyDependency', () => {
    it('should verify database connection successfully', async () => {
      mockDataSource.query.mockResolvedValue([{ '1': 1 }]);

      const result = await service.verifyDependency(DependencyType.DATABASE);

      expect(result.status).toBe(StartupStatus.COMPLETED);
      expect(result.type).toBe(DependencyType.DATABASE);
      expect(result.name).toBe('Database Connection');
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should handle database connection failure', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection failed'));

      const result = await service.verifyDependency(DependencyType.DATABASE);

      expect(result.status).toBe(StartupStatus.FAILED);
      expect(result.error).toBe('Connection failed');
    });

    it('should verify configuration successfully', async () => {
      mockConfigService.get
        .mockReturnValueOnce('localhost')
        .mockReturnValueOnce('5432')
        .mockReturnValueOnce('testdb')
        .mockReturnValueOnce('localhost')
        .mockReturnValueOnce('6379');

      const result = await service.verifyDependency(DependencyType.CONFIG);

      expect(result.status).toBe(StartupStatus.COMPLETED);
      expect(mockConfigService.get).toHaveBeenCalledWith('DATABASE_HOST');
      expect(mockConfigService.get).toHaveBeenCalledWith('DATABASE_PORT');
      expect(mockConfigService.get).toHaveBeenCalledWith('DATABASE_NAME');
      expect(mockConfigService.get).toHaveBeenCalledWith('REDIS_HOST');
      expect(mockConfigService.get).toHaveBeenCalledWith('REDIS_PORT');
    });

    it('should handle missing configuration', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.verifyDependency(DependencyType.CONFIG);

      expect(result.status).toBe(StartupStatus.FAILED);
      expect(result.error).toContain('Missing required environment variable');
    });

    it('should verify cache connection', async () => {
      mockConfigService.get
        .mockReturnValueOnce('localhost')
        .mockReturnValueOnce('6379');

      const result = await service.verifyDependency(DependencyType.CACHE);

      expect(result.status).toBe(StartupStatus.COMPLETED);
    });

    it('should handle missing cache configuration', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.verifyDependency(DependencyType.CACHE);

      expect(result.status).toBe(StartupStatus.FAILED);
    });

    it('should verify logging system', async () => {
      const result = await service.verifyDependency(DependencyType.LOGGING);

      expect(result.status).toBe(StartupStatus.COMPLETED);
    });

    it('should verify agent service', async () => {
      const result = await service.verifyDependency(DependencyType.AGENT);

      expect(result.status).toBe(StartupStatus.COMPLETED);
    });

    it('should verify oracle service', async () => {
      const result = await service.verifyDependency(DependencyType.ORACLE);

      expect(result.status).toBe(StartupStatus.COMPLETED);
    });

    it('should verify webhook system when configured', async () => {
      mockConfigService.get.mockReturnValue('https://webhook.example.com');

      const result = await service.verifyDependency(DependencyType.WEBHOOK);

      expect(result.status).toBe(StartupStatus.COMPLETED);
    });

    it('should handle missing webhook configuration', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.verifyDependency(DependencyType.WEBHOOK);

      expect(result.status).toBe(StartupStatus.FAILED);
    });

    it('should verify external API when configured', async () => {
      mockConfigService.get.mockReturnValue('https://api.example.com');

      const result = await service.verifyDependency(DependencyType.EXTERNAL_API);

      expect(result.status).toBe(StartupStatus.COMPLETED);
    });

    it('should handle missing external API configuration', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.verifyDependency(DependencyType.EXTERNAL_API);

      expect(result.status).toBe(StartupStatus.FAILED);
    });

    it('should handle timeout', async () => {
      // Mock a dependency that takes too long
      jest.spyOn(service as any, 'timeout').mockRejectedValue(new Error('Timeout after 10000ms'));

      const result = await service.verifyDependency(DependencyType.DATABASE);

      expect(result.status).toBe(StartupStatus.FAILED);
      expect(result.error).toBe('Timeout after 10000ms');
    });
  });

  describe('verifyDependencies', () => {
    it('should verify multiple dependencies', async () => {
      mockDataSource.query.mockResolvedValue([{ '1': 1 }]);
      mockConfigService.get
        .mockReturnValue('localhost')
        .mockReturnValue('5432')
        .mockReturnValue('testdb')
        .mockReturnValue('localhost')
        .mockReturnValue('6379');

      const result = await service.verifyDependencies([
        DependencyType.DATABASE,
        DependencyType.CONFIG,
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe(DependencyType.DATABASE);
      expect(result[1].type).toBe(DependencyType.CONFIG);
    });

    it('should stop on critical dependency failure', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.verifyDependencies([
        DependencyType.DATABASE,
        DependencyType.CACHE, // This should not be checked
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(DependencyType.DATABASE);
      expect(result[0].status).toBe(StartupStatus.FAILED);
    });
  });

  describe('getDependencyChecks', () => {
    it('should return all dependency checks', () => {
      const checks = service.getDependencyChecks();

      expect(checks).toHaveLength(8);
      expect(checks.map(c => c.type)).toContain(DependencyType.DATABASE);
      expect(checks.map(c => c.type)).toContain(DependencyType.CACHE);
      expect(checks.map(c => c.type)).toContain(DependencyType.CONFIG);
      expect(checks.map(c => c.type)).toContain(DependencyType.LOGGING);
      expect(checks.map(c => c.type)).toContain(DependencyType.AGENT);
      expect(checks.map(c => c.type)).toContain(DependencyType.ORACLE);
      expect(checks.map(c => c.type)).toContain(DependencyType.WEBHOOK);
      expect(checks.map(c => c.type)).toContain(DependencyType.EXTERNAL_API);
    });

    it('should mark critical dependencies correctly', () => {
      const checks = service.getDependencyChecks();
      
      const dbCheck = checks.find(c => c.type === DependencyType.DATABASE);
      const cacheCheck = checks.find(c => c.type === DependencyType.CACHE);
      const configCheck = checks.find(c => c.type === DependencyType.CONFIG);
      const webhookCheck = checks.find(c => c.type === DependencyType.WEBHOOK);

      expect(dbCheck?.critical).toBe(true);
      expect(cacheCheck?.critical).toBe(true);
      expect(configCheck?.critical).toBe(true);
      expect(webhookCheck?.critical).toBe(false);
    });
  });
});
