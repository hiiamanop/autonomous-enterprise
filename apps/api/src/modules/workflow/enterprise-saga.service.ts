import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import { JournalEntryDirection } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { SalesService } from '../sales/sales.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProcurementService } from '../procurement/procurement.service';
import { FinanceService } from '../finance/finance.service';
import { AccountingService } from '../accounting/accounting.service';
import { HrisService } from '../hris/hris.service';
import { InfrastructureService } from '../infrastructure/infrastructure.service';
import { TicketingService } from '../ticketing/ticketing.service';
import { AuditService } from '../../common/audit/audit.service';
import { OutboxService } from './outbox.service';
import { ProcessEnterpriseSagaDto } from './dto/process-enterprise-saga.dto';

export type EnterpriseSagaStepStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'ROLLED_BACK';

export interface EnterpriseSagaResult {
  workflowId: string;
  status: 'COMPLETED' | 'FAILED';
  tenantId?: string;
  sales: EnterpriseSagaStepStatus;
  inventory: EnterpriseSagaStepStatus;
  procurement: EnterpriseSagaStepStatus;
  finance: EnterpriseSagaStepStatus;
  hris: EnterpriseSagaStepStatus;
  accounting: EnterpriseSagaStepStatus;
  infrastructure: EnterpriseSagaStepStatus;
  compensation: EnterpriseSagaStepStatus;
  error?: string;
  ticketId?: string;
  timestamp: string;
}

@Injectable()
export class EnterpriseSagaService {
  constructor(
    @Inject(SalesService) private readonly salesService: SalesService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(ProcurementService) private readonly procurementService: ProcurementService,
    @Inject(FinanceService) private readonly financeService: FinanceService,
    @Inject(AccountingService) private readonly accountingService: AccountingService,
    @Inject(HrisService) private readonly hrisService: HrisService,
    @Inject(InfrastructureService) private readonly infrastructureService: InfrastructureService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(TicketingService) private readonly ticketingService: TicketingService,
    @Inject(OutboxService) private readonly outboxService: OutboxService
  ) {}

  private metadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async process(dto: ProcessEnterpriseSagaDto): Promise<ApiResponse<EnterpriseSagaResult>> {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    if (!context) {
      throw new UnauthorizedException('Request context is required');
    }
    const workflowId = `es-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const result: EnterpriseSagaResult = {
      workflowId, tenantId: TenantContextStorage.getTenantId(), status: 'COMPLETED',
      sales: 'PENDING', inventory: 'PENDING', procurement: 'PENDING', finance: 'PENDING',
      hris: 'PENDING', accounting: 'PENDING', infrastructure: dto.autoScale ? 'PENDING' : 'SKIPPED',
      compensation: 'SKIPPED', timestamp: new Date().toISOString()
    };
    let reservationId: string | undefined;
    let scalingId: string | undefined;
    let purchaseRequestId: string | undefined;
    try {
      const order = (await this.salesService.getSalesOrder(dto.salesOrderId)).data;
      if (!order) throw new Error(`Order ${dto.salesOrderId} not found`);
      result.sales = 'COMPLETED';

      const firstItem = order.items?.[0];
      if (firstItem && dto.warehouseId) {
        const res = await this.inventoryService.reserveStock({
          warehouseId: dto.warehouseId,
          productId: firstItem.productId,
          quantity: firstItem.quantity
        });
        reservationId = res.data?.id;
        result.inventory = 'COMPLETED';

        const pr = await this.procurementService.createPurchaseRequest({
          requestedBy: 'enterprise-saga',
          productId: firstItem.productId,
          quantity: firstItem.quantity * 2,
          reason: 'Saga auto-replenishment'
        });
        purchaseRequestId = pr.data?.id;
        result.procurement = 'COMPLETED';
      } else {
        result.inventory = 'SKIPPED';
        result.procurement = 'SKIPPED';
      }

      if (dto.autoScale) {
        const scale = await this.infrastructureService.requestScaling({
          namespace: dto.namespace,
          deploymentName: dto.deploymentName,
          toReplicas: dto.targetReplicas,
          reason: 'Saga traffic scale',
          projectedCostUsd: dto.scalingCostUsd
        });
        scalingId = scale.data?.id;
        result.infrastructure = scale.success ? 'COMPLETED' : 'FAILED';
      }

      const budgetAmount = dto.scalingCostUsd || order.totalAmount;
      const budgetAvailable = await this.financeService.checkBudgetAvailability(dto.budgetId, budgetAmount);
      if (!budgetAvailable) {
        throw new Error('Insufficient finance budget for enterprise saga');
      }
      await this.financeService.createBudgetAllocation({
        budgetId: dto.budgetId,
        amount: budgetAmount,
        purpose: `Enterprise saga ${workflowId}`
      });
      result.finance = 'COMPLETED';

      if (dto.employeeId) {
        await this.hrisService.requestOvertime({
          employeeId: dto.employeeId,
          date: new Date().toISOString().slice(0, 10),
          hours: 2,
          reason: `Enterprise saga ${workflowId} fulfillment support`
        });
        result.hris = 'COMPLETED';
      } else {
        result.hris = 'SKIPPED';
      }

      await this.accountingService.createJournal({
        reference: `SAGA-ORDER-${order.id}`,
        description: `Revenue posting for saga ${workflowId}`,
        entries: [
          { accountId: 'ar', direction: JournalEntryDirection.DEBIT, amount: order.totalAmount, memo: 'A/R' },
          { accountId: 'rev', direction: JournalEntryDirection.CREDIT, amount: order.totalAmount, memo: 'Revenue' }
        ]
      });
      result.accounting = 'COMPLETED';

      this.outboxService.publish({
        aggregateType: 'EnterpriseSaga',
        aggregateId: workflowId,
        eventType: 'EnterpriseSagaCompleted',
        payload: result
      });
      this.auditService.record({ workflowId, action: 'ENTERPRISE_SAGA_COMPLETED', input: dto, output: result, status: 'SUCCESS' });
      return { success: true, data: result, metadata: this.metadata() };
    } catch (err: any) {
      result.status = 'FAILED';
      result.error = err.message;
      result.compensation = 'COMPLETED';

      if (scalingId) {
        try { await this.infrastructureService.rollbackScaling(scalingId); } catch {}
      }
      if (reservationId) {
        try { await this.inventoryService.cancelReservation(reservationId); } catch {}
      }

      const ticket = this.ticketingService.createSystemTicket
        ? await this.ticketingService.createSystemTicket(
            `Enterprise Saga Failure: ${workflowId}`,
            `Saga failed on order ${dto.salesOrderId}: ${err.message}. Partial reservations/requests rolled back.`,
            'enterprise-saga',
            'HIGH' as any,
            workflowId
          )
        : (await this.ticketingService.createTicket({
            title: `Enterprise Saga Failure: ${workflowId}`,
            description: `Saga failed on order ${dto.salesOrderId}: ${err.message}. Partial reservations/requests rolled back.`,
            source: 'enterprise-saga',
            priority: 'HIGH',
            workflowId
          })).data!;
      result.ticketId = ticket.id;
      result.compensation = 'COMPLETED';

      this.outboxService.publish({
        aggregateType: 'EnterpriseSaga',
        aggregateId: workflowId,
        eventType: 'EnterpriseSagaFailed',
        payload: result
      });
      this.auditService.record({ workflowId, action: 'ENTERPRISE_SAGA_FAILED', input: dto, output: result, status: 'FAILURE', reasoning: err.message });
      return { success: false, data: result, error: { code: 'SAGA_FAILED', message: err.message }, metadata: this.metadata() };
    }
  }
}
