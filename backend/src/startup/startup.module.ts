import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DependencyVerificationService } from './services/dependency-verification.service';
import { StartupValidatorService } from './services/startup-validator.service';
import { StartupController } from './controllers/startup.controller';
import { StartupService } from './services/startup.service';
import { HealthController } from './controllers/health.controller';

@Module({
  imports: [
    TypeOrmModule,
    ConfigModule,
  ],
  providers: [
    DependencyVerificationService,
    StartupValidatorService,
    StartupService,
  ],
  controllers: [
    StartupController,
    HealthController,
  ],
  exports: [
    DependencyVerificationService,
    StartupValidatorService,
    StartupService,
  ],
})
export class StartupModule {}
