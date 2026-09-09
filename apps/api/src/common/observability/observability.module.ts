import { Module } from '@nestjs/common';
import { AgentRegistryModule } from '../../modules/agent-registry/agent-registry.module';
import { AiBudgetModule } from '../../modules/ai-budget/ai-budget.module';
import { InfrastructureModule } from '../../modules/infrastructure/infrastructure.module';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';

@Module({
  imports: [AgentRegistryModule, AiBudgetModule, InfrastructureModule],
  controllers: [ObservabilityController],
  providers: [ObservabilityService],
  exports: [ObservabilityService]
})
export class ObservabilityModule {}
