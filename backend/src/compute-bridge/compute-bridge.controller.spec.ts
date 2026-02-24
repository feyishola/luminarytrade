import { Test, TestingModule } from '@nestjs/testing';
import { ComputeBridgeController } from './compute-bridge.controller';
import { AIOrchestrationService } from './service/ai-orchestration.service';

describe('ComputeBridgeController', () => {
  let controller: ComputeBridgeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComputeBridgeController],
      providers: [
        {
          provide: AIOrchestrationService,
          useValue: {
            scoreUser: jest.fn(),
            getResult: jest.fn(),
            getUserResults: jest.fn(),
            healthCheck: jest.fn(),
            verifySignature: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ComputeBridgeController>(ComputeBridgeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
