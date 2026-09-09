import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { ProcurementService } from '../procurement/procurement.service';
import { FinanceService } from '../finance/finance.service';
import { AuditService } from '../../common/audit/audit.service';
import { PolicyEngineService } from '../../common/policy/policy-engine.service';
import type { PolicyEvaluationResult } from '../../common/policy/policy.types';
import { OutboxService } from './outbox.service';
import { ProcessPurchaseApprovalDto } from './dto/process-purchase-approval.dto';

export interface PurchaseApprovalResult {
  workflowId: string;
  purchaseOrderId: string;
  budgetId: string;
  policy: PolicyEvaluationResult;
  purchaseOrderStatus: string;
  idempotencyKey?: string;
  timestamp: string;
}

const DEFAULT_AUTO_APPROVAL_THRESHOLD = 5_000_000;

@Injectable()
export class PurchaseApprovalService {
  private readonly idempotencyStore = new Map<string, ApiResponse<PurchaseApprovalResult>>();

  constructor(
    @Inject(ProcurementService) private readonly procurementService: ProcurementService,
    @Inject(FinanceService) private readonly financeService: FinanceService,
    @Inject(PolicyEngineService) private readonly policyEngine: PolicyEngineService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(OutboxService) private readonly outboxService: OutboxService
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async processPurchaseApproval(
    dto: ProcessPurchaseApprovalDto,
    headerIdempotencyKey?: string
  ): Promise<ApiResponse<PurchaseApprovalResult>> {
    const idempotencyKey = headerIdempotencyKey || dto.idempotencyKey;

    if (idempotencyKey) {
      const cached = this.idempotencyStore.get(idempotencyKey);
      if (cached) {
        return cached;
      }
    }

    if (!dto.purchaseOrderId) {
      throw new BadRequestException('purchaseOrderId is required');
    }
    if (!dto.budgetId) {
      throw new BadRequestException('budgetId is required');
    }

    const workflowId = `wf-pa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.auditService.record({
      workflowId,
      action: 'WORKFLOW_PURCHASE_APPROVAL_STARTED',
      input: { purchaseOrderId: dto.purchaseOrderId, budgetId: dto.budgetId },
      status: 'SUCCESS'
    });

    const poResponse = await this.procurementService.getPurchaseOrder(dto.purchaseOrderId);
    const po = poResponse.data;
    if (!po) {
      throw new NotFoundException(`PurchaseOrder [${dto.purchaseOrderId}] not found`);
    }

    const isBudgetSufficient = await this.financeService.checkBudgetAvailability(
      dto.budgetId,
      po.totalAmount
    );
    const remainingBudget = isBudgetSufficient ? po.totalAmount : 0;
    const autoApprovalThreshold = dto.autoApprovalThreshold ?? DEFAULT_AUTO_APPROVAL_THRESHOLD;

    const policyResult = this.policyEngine.evaluateProcurementPolicy({
      amount: po.totalAmount,
      budgetAvailable: isBudgetSufficient,
      supplierVerified: true,
      autoApprovalThreshold
    });

    this.auditService.record({
      workflowId,
      action: 'WORKFLOW_PURCHASE_APPROVAL_POLICY_EVALUATED',
      input: {
        purchaseOrderId: po.id,
        amount: po.totalAmount,
        remainingBudget,
        isBudgetSufficient
      },
      output: policyResult,
      status: 'SUCCESS'
    });

    let purchaseOrderStatus = po.status;

    if (policyResult.decision === 'AUTO_APPROVE') {
      const updatedPo = await this.procurementService.approvePurchaseOrder(po.id);
      if (updatedPo.data) {
        purchaseOrderStatus = updatedPo.data.status;
      }

      try {
        await this.financeService.createBudgetAllocation({
          budgetId: dto.budgetId,
          amount: po.totalAmount,
          purpose: `Purchase order ${po.id}`
        });
      } catch (err: any) {
        await this.procurementService.revertPurchaseOrderToDraft(po.id);

        this.auditService.record({
          workflowId,
          action: 'WORKFLOW_PURCHASE_APPROVAL_COMPENSATED',
          input: { purchaseOrderId: po.id, budgetId: dto.budgetId },
          status: 'FAILURE',
          reasoning: err.message
        });

        throw new BadRequestException(
          `Budget allocation failed; purchase order reverted to DRAFT: ${err.message}`
        );
      }

      this.outboxService.publish({
        aggregateType: 'PurchaseOrder',
        aggregateId: po.id,
        eventType: 'PurchaseOrderApproved',
        payload: {
          purchaseOrderId: po.id,
          amount: po.totalAmount,
          budgetId: dto.budgetId
        }
      });
    } else if (policyResult.decision === 'REQUIRE_HUMAN_APPROVAL') {
      this.outboxService.publish({
        aggregateType: 'PurchaseOrder',
        aggregateId: po.id,
        eventType: 'PurchaseApprovalEscalated',
        payload: {
          purchaseOrderId: po.id,
          amount: po.totalAmount,
          reasons: policyResult.reasons
        }
      });
    }

    const result: PurchaseApprovalResult = {
      workflowId,
      purchaseOrderId: po.id,
      budgetId: dto.budgetId,
      policy: policyResult,
      purchaseOrderStatus,
      idempotencyKey,
      timestamp: new Date().toISOString()
    };

    const response: ApiResponse<PurchaseApprovalResult> = {
      success: true,
      data: result,
      metadata: this.buildMetadata()
    };

    if (idempotencyKey) {
      this.idempotencyStore.set(idempotencyKey, response);
    }

    return response;
  }
}
