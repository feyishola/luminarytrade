import { Test, TestingModule } from '@nestjs/testing';
import { ComputeBridgeController } from './compute-bridge.controller';

describe('ComputeBridgeController', () => {
  let controller: ComputeBridgeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComputeBridgeController],
    }).compile();

    controller = module.get<ComputeBridgeController>(ComputeBridgeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
