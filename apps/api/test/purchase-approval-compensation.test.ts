import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PurchaseApprovalService } from '../src/modules/workflow/purchase-approval.service';
import { ProcurementService } from '../src/modules/procurement/procurement.service';
import { FinanceService } from '../src/modules/finance/finance.service';
import { PolicyEngineService } from '../src/common/policy/policy-engine.service';
import { AuditService } from '../src/common/audit/audit.service';
import { OutboxService } from '../src/modules/workflow/outbox.service';
import { TenantContextStorage } from '@autonomous-enterprise/shared';

describe('Purchase Approval Compensation Logic', () => {
  let service: PurchaseApprovalService;
  let procurementService: { getPurchaseOrder: ReturnType<typeof vi.fn>; getSupplier: ReturnType<typeof vi.fn>; approvePurchaseOrder: ReturnType<typeof vi.fn>; revertPurchaseOrderToDraft: ReturnType<typeof vi.fn> };
  let financeService: { checkBudgetAvailability: ReturnType<typeof vi.fn>; createBudgetAllocation: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    procurementService = {
      getPurchaseOrder: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'po-compensation-1',
          supplierId: 'sup-1',
          totalAmount: 5000,
          status: 'DRAFT'
        }
      }),
      getSupplier: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'sup-1', isVerified: true }
      }),
      approvePurchaseOrder: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'po-compensation-1', status: 'APPROVED' }
      }),
      revertPurchaseOrderToDraft: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'po-compensation-1', status: 'DRAFT' }
      })
    };

    financeService = {
      checkBudgetAvailability: vi.fn().mockResolvedValue(true),
      createBudgetAllocation: vi.fn().mockRejectedValue(new Error('Budget allocation race condition'))
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseApprovalService,
        { provide: ProcurementService, useValue: procurementService },
        { provide: FinanceService, useValue: financeService },
        PolicyEngineService,
        AuditService,
        OutboxService
      ]
    }).compile();

    service = moduleRef.get(PurchaseApprovalService);
  });

  it('should revert purchase order to DRAFT if budget allocation fails after approval', async () => {
    await TenantContextStorage.run(
      { tenantId: 'tenant-compensation', actor: { id: 'sys', type: 'agent', tenantId: 'tenant-compensation', roles: [], permissions: [] } },
      async () => {
        await expect(
          service.processPurchaseApproval({
            purchaseOrderId: 'po-compensation-1',
            budgetId: 'budget-1'
          })
        ).rejects.toThrow(BadRequestException);
      }
    );

    expect(procurementService.approvePurchaseOrder).toHaveBeenCalledWith('po-compensation-1');
    expect(financeService.createBudgetAllocation).toHaveBeenCalled();
    expect(procurementService.revertPurchaseOrderToDraft).toHaveBeenCalledWith('po-compensation-1');
  });
});
