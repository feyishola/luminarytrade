import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { AIResultEntity, AIResultStatus } from './entities/ai-result-entity';
import { ComputeBridgeModule } from './compute-bridge.module';

describe('AI Orchestration Integration Tests (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || 'test',
          password: process.env.DB_PASSWORD || 'test',
          database: process.env.DB_DATABASE || 'test_db',
          entities: [AIResultEntity],
          synchronize: true,
          dropSchema: true,
        }),
        ComputeBridgeModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /compute-bridge/score', () => {
    it('should accept scoring request and return pending result', async () => {
      const scoringRequest = {
        userId: 'user-123',
        userData: {
          income: 75000,
          expenses: 45000,
          debt: 15000,
          creditHistory: [
            { type: 'credit_card', balance: 5000, limit: 10000 },
            { type: 'auto_loan', balance: 10000, monthlyPayment: 350 },
          ],
          employmentStatus: 'full-time',
          age: 32,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/compute-bridge/score')
        .send(scoringRequest)
        .expect(202);

      expect(response.body).toHaveProperty('resultId');
      expect(response.body.userId).toBe('user-123');
      expect(response.body).toHaveProperty('provider');
      expect(response.body.creditScore).toBeNull();
    });

    it('should validate request data', async () => {
      const invalidRequest = {
        userId: '',
        userData: null,
      };

      await request(app.getHttpServer())
        .post('/compute-bridge/score')
        .send(invalidRequest)
        .expect(400);
    });
  });

  describe('GET /compute-bridge/results/:id', () => {
    it('should retrieve scoring result', async () => {
      // First create a scoring request
      const scoringRequest = {
        userId: 'user-456',
        userData: {
          income: 60000,
          expenses: 40000,
          debt: 8000,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/compute-bridge/score')
        .send(scoringRequest);

      const resultId = createResponse.body.resultId;

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Retrieve the result
      const getResponse = await request(app.getHttpServer())
        .get(`/compute-bridge/results/${resultId}`)
        .expect(200);

      expect(getResponse.body).toHaveProperty('id', resultId);
      expect(getResponse.body).toHaveProperty('userId', 'user-456');
      expect(getResponse.body).toHaveProperty('status');
    });
  });

  describe('Scoring Workflow', () => {
    it('should complete full scoring workflow with all steps', async () => {
      const scoringRequest = {
        userId: 'user-workflow-test',
        userData: {
          income: 90000,
          expenses: 50000,
          debt: 20000,
          creditHistory: [
            { type: 'mortgage', balance: 200000, monthlyPayment: 1500 },
            { type: 'credit_card', balance: 3000, limit: 15000 },
          ],
          employmentStatus: 'full-time',
          age: 38,
          employmentYears: 10,
        },
      };

      // Step 1: Submit scoring request
      const createResponse = await request(app.getHttpServer())
        .post('/compute-bridge/score')
        .send(scoringRequest)
        .expect(202);

      const resultId = createResponse.body.resultId;
      expect(resultId).toBeDefined();

      // Step 2: Poll for completion (in real scenario, use webhooks)
      let result: any;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const response = await request(app.getHttpServer())
          .get(`/compute-bridge/results/${resultId}`)
          .expect(200);

        result = response.body;

        if (result.status === AIResultStatus.SUCCESS || result.status === AIResultStatus.FAILED) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      // Step 3: Verify result is complete
      expect(result.status).toBe(AIResultStatus.SUCCESS);
      expect(result.creditScore).toBeDefined();
      expect(result.riskScore).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.completedAt).toBeDefined();

      // Step 4: Verify signature
      const verifyResponse = await request(app.getHttpServer())
        .post(`/compute-bridge/verify/${resultId}`)
        .expect(201);

      expect(verifyResponse.body.valid).toBe(true);

      // Step 5: Check scores are in valid ranges
      expect(result.creditScore).toBeGreaterThanOrEqual(0);
      expect(result.creditScore).toBeLessThanOrEqual(100);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high', 'very-high']).toContain(result.riskLevel);
    });
  });

  describe('Provider Failover', () => {
    it('should handle provider failures with retries', async () => {
      const scoringRequest = {
        userId: 'user-failover-test',
        userData: {
          income: 50000,
          expenses: 35000,
          debt: 5000,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/compute-bridge/score')
        .send(scoringRequest)
        .expect(202);

      const resultId = response.body.resultId;

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await request(app.getHttpServer())
        .get(`/compute-bridge/results/${resultId}`)
        .expect(200);

      // Should have attempted retries
      expect(result.body.retryCount).toBeGreaterThan(0);
    });
  });

  describe('GET /compute-bridge/users/:userId/results', () => {
    it('should retrieve all results for a user', async () => {
      const userId = 'user-multiple-results';

      // Create multiple scoring requests
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/compute-bridge/score')
          .send({
            userId,
            userData: { income: 50000 + i * 10000, expenses: 30000 },
          });
      }

      const response = await request(app.getHttpServer())
        .get(`/compute-bridge/users/${userId}/results`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
      expect(response.body[0].userId).toBe(userId);
    });
  });

  describe('GET /compute-bridge/health', () => {
    it('should return health status of all providers', async () => {
      const response = await request(app.getHttpServer())
        .get('/compute-bridge/health')
        .expect(200);

      expect(response.body).toHaveProperty('openai');
      expect(typeof response.body.openai).toBe('boolean');
    });
  });
});