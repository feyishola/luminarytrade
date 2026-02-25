import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionManager } from './transaction-manager.service';
import { TransactionMonitorService } from './transaction-monitor.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [TransactionManager, TransactionMonitorService],
  exports: [TransactionManager, TransactionMonitorService],
})
export class TransactionModule {}
