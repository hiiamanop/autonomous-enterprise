import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { AiBudgetModule } from '../../modules/ai-budget/ai-budget.module';
import { SalesModule } from '../../modules/sales/sales.module';
import { InventoryModule } from '../../modules/inventory/inventory.module';
import { HrisModule } from '../../modules/hris/hris.module';
import { InfrastructureModule } from '../../modules/infrastructure/infrastructure.module';
import { TicketingModule } from '../../modules/ticketing/ticketing.module';
import { AgentRuntimeService } from './agent-runtime.service';
import { EnterpriseToolsFactory } from './enterprise-tools.factory';

@Module({
  imports: [
    AiProviderModule,
    AiBudgetModule,
    SalesModule,
    InventoryModule,
    HrisModule,
    InfrastructureModule,
    TicketingModule
  ],
  providers: [AgentRuntimeService, EnterpriseToolsFactory],
  exports: [AgentRuntimeService, EnterpriseToolsFactory]
})
export class AgentRuntimeModule {}
