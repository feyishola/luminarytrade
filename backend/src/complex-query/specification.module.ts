import { Module, Global } from '@nestjs/common';
import { SpecificationExecutor } from './core/specification-executor';
import { SpecificationCache } from './cache/specification-cache';
import { SpecificationValidator } from './validation/specification-validator';

@Global()
@Module({
  providers: [SpecificationExecutor, SpecificationCache, SpecificationValidator],
  exports: [SpecificationExecutor, SpecificationCache, SpecificationValidator],
})
export class SpecificationModule {}
