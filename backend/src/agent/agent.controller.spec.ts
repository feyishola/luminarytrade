import { Test, TestingModule } from '@nestjs/testing';
import { IndexerController } from './agent.controller';
import { IndexerService } from './indexer.service';

describe('AgentController', () => {
  let controller: IndexerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndexerController],
      providers: [
        {
          provide: IndexerService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<IndexerController>(IndexerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
