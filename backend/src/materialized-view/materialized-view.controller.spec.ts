import { Test, TestingModule } from '@nestjs/testing';
import { MaterializedViewController } from './materialized-view.controller';
import { MaterializedViewService } from './materialized-view.service';

describe('MaterializedViewController', () => {
  let controller: MaterializedViewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaterializedViewController],
      providers: [MaterializedViewService],
    }).compile();

    controller = module.get<MaterializedViewController>(MaterializedViewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
