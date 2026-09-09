import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { FinanceModule } from '../finance/finance.module';
import { AccountingModule } from '../accounting/accounting.module';
import { HrisModule } from '../hris/hris.module';
import { WorkflowTaskModule } from '../workflow-task/workflow-task.module';
import { PolicyModule } from '../../common/policy/policy.module';
import { OrchestrationModule } from '../../common/orchestration/orchestration.module';
import { WorkflowController } from './workflow.controller';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { PurchaseApprovalService } from './purchase-approval.service';
import { ReplenishmentService } from './replenishment.service';
import { FinancialPostingService } from './financial-posting.service';
import { OvertimeApprovalService } from './overtime-approval.service';
import { OutboxService } from './outbox.service';
import { MessagingModule } from '../../common/messaging/messaging.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { TicketingModule } from '../ticketing/ticketing.module';
import { EnterpriseSagaService } from './enterprise-saga.service';

@Module({
  imports: [
    SalesModule,
    InventoryModule,
    ProcurementModule,
    FinanceModule,
    AccountingModule,
    HrisModule,
    InfrastructureModule,
    TicketingModule,
    WorkflowTaskModule,
    PolicyModule,
    OrchestrationModule,
    MessagingModule
  ],
  controllers: [WorkflowController],
  providers: [
    OrderFulfillmentService,
    PurchaseApprovalService,
    ReplenishmentService,
    FinancialPostingService,
    OvertimeApprovalService,
    OutboxService,
    EnterpriseSagaService
  ],
  exports: [
    OrderFulfillmentService,
    PurchaseApprovalService,
    ReplenishmentService,
    FinancialPostingService,
    OvertimeApprovalService,
    OutboxService,
    EnterpriseSagaService
  ]
})
export class WorkflowModule {}
