import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { EventStoreEntity } from './entities/event-store.entity';
import { EventSnapshot } from './entities/event-snapshot.entity';
import { SagaDataEntity } from './saga/entities/saga-data.entity';

// Services
import { EventStore } from './event-store.service';
import { NestEventBus } from './nest-event-bus.service';
import { EventReplayService } from './event-replay.service';
import { DefaultSnapshotService } from './snapshot.service';
import { SagaManager } from './saga/saga-manager.service';
import { TypeOrmSagaPersistence } from './saga/typeorm-saga-persistence.service';
import { AIScoringSaga } from './saga/ai-scoring.saga';
import { EventMonitoringService } from './monitoring.service';
import { EventMetricsCollector } from './metrics-collector.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventStoreEntity,
      EventSnapshot,
      SagaDataEntity,
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  providers: [
    EventStore,
    NestEventBus,
    EventReplayService,
    DefaultSnapshotService,
    SagaManager,
    TypeOrmSagaPersistence,
    AIScoringSaga,
    EventMonitoringService,
    EventMetricsCollector,
    {
      provide: 'EventBus',
      useExisting: NestEventBus,
    },
  ],
  exports: [
    EventStore,
    NestEventBus,
    EventReplayService,
    DefaultSnapshotService,
    SagaManager,
    EventMonitoringService,
    {
      provide: 'EventBus',
      useExisting: NestEventBus,
    },
  ],
})
export class EventModule {}
