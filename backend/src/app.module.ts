import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SimulatorModule } from './simulator/simulator.module';

export class AppModule {}
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { SubmitterModule } from './submitter/submitter.module';
import { ComputeBridgeModule } from './compute-bridge/compute-bridge.module';
import { IndexerModule } from './agent/agent.module';
import { AuditLogModule } from './audit/audit-log.module';
import { WorkerModule } from './worker/worker.module';
import { MaterializedViewModule } from './materialized-view/materialized-view.module';

@Module({
  imports: [SimulatorModule, OracleModule, MaterializedViewModule],
  controllers: [AppController],
})
export class AppModule {}
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'submitter',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    SubmitterModule,
    ComputeBridgeModule,
    IndexerModule,
    AuditLogModule,
    WorkerModule,
  ],
  controllers: [AppController],

})
export class AppModule { }
