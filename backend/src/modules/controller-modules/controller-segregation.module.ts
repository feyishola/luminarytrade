import { Module } from '@nestjs/common';
import { IndexerModule } from '../../agent/agent.module';
import { OracleModule } from '../../oracle/oracle.module';
import { ComputeBridgeModule } from '../../compute-bridge/compute-bridge.module';
import { AuditLogModule } from '../../audit/audit-log.module';

// Import new segregated controllers
import { AgentCRUDController } from '../../agent/agent-crud.controller';
import { AgentSearchController } from '../../agent/agent-search.controller';
import { OracleCRUDController } from '../../oracle/oracle-crud.controller';
import { OracleQueryController } from '../../oracle/oracle-query.controller';
import { ComputeBridgeCRUDController } from '../../compute-bridge/compute-bridge-crud.controller';
import { ComputeBridgeQueryController } from '../../compute-bridge/compute-bridge-query.controller';
import { AuditLogQueryController } from '../../audit/audit-log-query.controller';

@Module({
  imports: [
    IndexerModule,
    OracleModule,
    ComputeBridgeModule,
    AuditLogModule,
  ],
  controllers: [
    // Agent controllers
    AgentCRUDController,
    AgentSearchController,
    
    // Oracle controllers
    OracleCRUDController,
    OracleQueryController,
    
    // Compute Bridge controllers
    ComputeBridgeCRUDController,
    ComputeBridgeQueryController,
    
    // Audit controllers
    AuditLogQueryController,
  ],
  providers: [],
})
export class ControllerSegregationModule {}