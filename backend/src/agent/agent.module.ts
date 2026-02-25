import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerService } from './indexer.service';
import { Agent } from './entities/agent.entity';
import { IndexerController } from './agent.controller';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent]),
    CacheModule,
  ],
  controllers: [IndexerController],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}