import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";

import { AppController } from "./app.controller";
import { SimulatorModule } from "./simulator/simulator.module";
import { SubmitterModule } from "./submitter/submitter.module";
import { ComputeBridgeModule } from "./compute-bridge/compute-bridge.module";
import { IndexerModule } from "./agent/agent.module";
import { AuditLogModule } from "./audit/audit-log.module";
import { WorkerModule } from "./worker/worker.module";
import { OracleModule } from "./oracle/oracle.module";
import { TransactionModule } from "./transaction/transaction.module";
import { RateLimitingModule } from "./rate-limiting/rate-limiting.module";
import { TracingModule } from "./tracing/tracing.module";
import { AuthModule } from "./auth/auth.module";
import { StartupModule } from "./startup/startup.module";

import { DatabaseConfigFactory } from "./config/database.factory";
import { CacheConfigFactory } from "./config/cache.factory";
import { PluginsModule } from "./plugins/plugins.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Startup Module - First to ensure proper initialization order
    StartupModule,

    PluginsModule,

    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const factory = new DatabaseConfigFactory();
        return factory.createConfig();
      },
    }),

    BullModule.forRootAsync({
      useFactory: () => {
        const factory = new CacheConfigFactory();
        return factory.createConfig();
      },
    }),

    TracingModule,
    TransactionModule,
    SimulatorModule,
    SubmitterModule,
    ComputeBridgeModule,
    IndexerModule,
    AuditLogModule,
    WorkerModule,
    OracleModule,
    RateLimitingModule,
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
