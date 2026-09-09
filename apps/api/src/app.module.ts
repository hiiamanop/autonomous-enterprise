import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware';
import { AuditModule } from './common/audit/audit.module';
import { AgentContractService } from './common/agent/agent-contract.service';
import { FoundationController } from './foundation/foundation.controller';
import { FoundationService } from './foundation/foundation.service';
import { AuthModule } from './common/auth/auth.module';
import { DatabaseModule } from './common/database/database.module';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { SalesModule } from './modules/sales/sales.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { TicketingModule } from './modules/ticketing/ticketing.module';
import { WorkflowTaskModule } from './modules/workflow-task/workflow-task.module';
import { OrchestrationModule } from './common/orchestration/orchestration.module';
import { AgentRegistryModule } from './modules/agent-registry/agent-registry.module';
import { AiBudgetModule } from './modules/ai-budget/ai-budget.module';
import { AiProviderModule } from './common/ai-provider/ai-provider.module';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module';
import { HrisModule } from './modules/hris/hris.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { InfrastructureModule } from './modules/infrastructure/infrastructure.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { ExperimentModule } from './modules/experiment/experiment.module';
import { EventStreamModule } from './common/events/event-stream.module';
import { SimulatorModule } from './modules/simulator/simulator.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 300
      }
    ]),
    AuditModule,
    AuthModule,
    DatabaseModule,
    SalesModule,
    InventoryModule,
    FinanceModule,
    ProcurementModule,
    WorkflowModule,
    AccountingModule,
    TicketingModule,
    WorkflowTaskModule,
    OrchestrationModule,
    AgentRegistryModule,
    AiBudgetModule,
    AiProviderModule,
    OrchestratorModule,
    HrisModule,
    KnowledgeModule,
    InfrastructureModule,
    ObservabilityModule,
    ExperimentModule,
    EventStreamModule,
    SimulatorModule
  ],
  controllers: [AppController, FoundationController],
  providers: [
    AppService,
    FoundationService,
    AgentContractService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
