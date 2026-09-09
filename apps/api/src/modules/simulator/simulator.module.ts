import { Module } from '@nestjs/common';
import { AiProviderModule } from '../../common/ai-provider/ai-provider.module';
import { EventStreamModule } from '../../common/events/event-stream.module';
import { AuditModule } from '../../common/audit/audit.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { AgentRegistryModule } from '../agent-registry/agent-registry.module';
import { AiBudgetModule } from '../ai-budget/ai-budget.module';
import { SalesModule } from '../sales/sales.module';
import { InventoryModule } from '../inventory/inventory.module';
import { HrisModule } from '../hris/hris.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AgentRuntimeModule } from '../../common/agent-runtime/agent-runtime.module';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';

@Module({
  imports: [
    EventStreamModule,
    AuditModule,
    AiProviderModule,
    OrchestratorModule,
    AgentRegistryModule,
    AiBudgetModule,
    SalesModule,
    InventoryModule,
    HrisModule,
    InfrastructureModule,
    AgentRuntimeModule
  ],
  controllers: [SimulatorController],
  providers: [SimulatorService],
  exports: [SimulatorService]
})
export class SimulatorModule {}
