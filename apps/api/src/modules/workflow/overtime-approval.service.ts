import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { HrisService } from '../hris/hris.service';
import { FinanceService } from '../finance/finance.service';
import { AuditService } from '../../common/audit/audit.service';
import { ConflictResolutionService } from '../../common/orchestration/conflict-resolution.service';
import type { ConflictParty } from '../../common/orchestration/conflict.types';
import { ProcessOvertimeApprovalDto } from './dto/process-overtime-approval.dto';

export interface OvertimeApprovalResult {
  workflowId: string;
  overtimeRequestId: string;
  overtimeStatus: string;
  hrisDecision: string;
  financeDecision: string;
  resolved: boolean;
  escalated: boolean;
  ticketId?: string;
  reasons: string[];
  timestamp: string;
}

const OVERTIME_JUSTIFICATION_THRESHOLD_USD = 200;

@Injectable()
export class OvertimeApprovalService {
  constructor(
    @Inject(HrisService) private readonly hrisService: HrisService,
    @Inject(FinanceService) private readonly financeService: FinanceService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(ConflictResolutionService)
    private readonly conflictResolutionService: ConflictResolutionService
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async processOvertimeApproval(
    dto: ProcessOvertimeApprovalDto
  ): Promise<ApiResponse<OvertimeApprovalResult>> {
    if (!dto.overtimeRequestId) {
      throw new BadRequestException('overtimeRequestId is required');
    }

    const workflowId = `wf-oa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.auditService.record({
      workflowId,
      action: 'WORKFLOW_OVERTIME_APPROVAL_STARTED',
      input: { overtimeRequestId: dto.overtimeRequestId },
      status: 'SUCCESS'
    });

    const requests = await this.hrisService.listRecentOvertimeRequests(60);
    const overtimeRequest = requests.data?.find((r) => r.id === dto.overtimeRequestId);

    if (!overtimeRequest) {
      throw new NotFoundException(`OvertimeRequest [${dto.overtimeRequestId}] not found`);
    }

    const employeeResponse = await this.hrisService.getEmployee(overtimeRequest.employeeId);
    const employee = employeeResponse.data;
    if (!employee) {
      throw new NotFoundException(`Employee [${overtimeRequest.employeeId}] not found`);
    }

    const workloadResponse = await this.hrisService.getWorkloadSummary(employee.departmentId);
    const workload = workloadResponse.data;

    const isHrisApproved =
      dto.hrisUrgentFlag === true ||
      (workload !== undefined && workload.isOverloaded) ||
      Boolean(overtimeRequest.reason);
    const hrisDecision = isHrisApproved ? 'OVERTIME_REQUIRED' : 'OVERTIME_NOT_JUSTIFIED';

    const estimatedCost = overtimeRequest.estimatedCost;
    let isBudgetInsufficient = false;
    if (dto.budgetId) {
      isBudgetInsufficient = !(await this.financeService.checkBudgetAvailability(
        dto.budgetId,
        estimatedCost
      ));
    }

    const isBudgetBreached =
      dto.financeBudgetBreachedFlag === true ||
      isBudgetInsufficient ||
      estimatedCost > OVERTIME_JUSTIFICATION_THRESHOLD_USD;
    const financeDecision = isBudgetBreached ? 'OVERTIME_NOT_JUSTIFIED' : 'OVERTIME_REQUIRED';

    const reasons: string[] = [];
    if (isHrisApproved) {
      reasons.push(
        dto.hrisUrgentFlag
          ? 'HRIS: Flagged as urgent operational demand'
          : 'HRIS: Department is currently overloaded'
      );
    } else {
      reasons.push('HRIS: Department workload is within normal limits; overtime not justified');
    }

    if (isBudgetBreached) {
      reasons.push(
        dto.financeBudgetBreachedFlag
          ? 'Finance: Overtime budget allocation breached'
          : `Finance: Estimated cost ($${estimatedCost}) exceeds justification threshold ($${OVERTIME_JUSTIFICATION_THRESHOLD_USD})`
      );
    } else {
      reasons.push('Finance: Overtime cost is within approved departmental budget limits');
    }

    let resolved = false;
    let escalated = false;
    let ticketId: string | undefined;
    let finalStatus: string = overtimeRequest.status;

    if (hrisDecision === 'OVERTIME_REQUIRED' && financeDecision === 'OVERTIME_REQUIRED') {
      const approved = await this.hrisService.approveOvertime(overtimeRequest.id);
      finalStatus = approved.data?.status || 'APPROVED';
      resolved = true;
    } else if (hrisDecision === 'OVERTIME_NOT_JUSTIFIED' && financeDecision === 'OVERTIME_NOT_JUSTIFIED') {
      const rejected = await this.hrisService.rejectOvertime(overtimeRequest.id);
      finalStatus = rejected.data?.status || 'REJECTED';
      resolved = true;
    } else {
      const partyA: ConflictParty = {
        name: 'HRIS_AGENT',
        decision: hrisDecision,
        trustScore: 0.9
      };

      const partyB: ConflictParty = {
        name: 'FINANCE_AGENT',
        decision: financeDecision,
        trustScore: 0.9
      };

      const conflictResult = await this.conflictResolutionService.detectAndResolve(
        partyA,
        partyB,
        workflowId
      );

      resolved = conflictResult.resolved;
      escalated = conflictResult.escalated;
      ticketId = conflictResult.ticketId;
    }

    this.auditService.record({
      workflowId,
      action: 'WORKFLOW_OVERTIME_APPROVAL_COMPLETED',
      input: {
        overtimeRequestId: overtimeRequest.id,
        hrisDecision,
        financeDecision,
        estimatedCost
      },
      output: { finalStatus, resolved, escalated, ticketId },
      status: 'SUCCESS'
    });

    const result: OvertimeApprovalResult = {
      workflowId,
      overtimeRequestId: overtimeRequest.id,
      overtimeStatus: finalStatus,
      hrisDecision,
      financeDecision,
      resolved,
      escalated,
      ticketId,
      reasons,
      timestamp: new Date().toISOString()
    };

    return {
      success: true,
      data: result,
      metadata: this.buildMetadata()
    };
  }
}
