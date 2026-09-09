import { Module } from '@nestjs/common';
import { AiProviderModule } from '../../common/ai-provider/ai-provider.module';
import { AiBudgetModule } from '../ai-budget/ai-budget.module';
import { AgentRegistryModule } from '../agent-registry/agent-registry.module';
import { WorkflowTaskModule } from '../workflow-task/workflow-task.module';
import { TicketingModule } from '../ticketing/ticketing.module';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';

@Module({
  imports: [AiProviderModule, AiBudgetModule, AgentRegistryModule, WorkflowTaskModule, TicketingModule],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
  exports: [OrchestratorService]
})
export class OrchestratorModule {}
