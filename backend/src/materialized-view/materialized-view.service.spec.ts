import { Test, TestingModule } from '@nestjs/testing';
import { MaterializedViewService } from './materialized-view.service';

describe('MaterializedViewService', () => {
  let service: MaterializedViewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MaterializedViewService],
    }).compile();

    service = module.get<MaterializedViewService>(MaterializedViewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
