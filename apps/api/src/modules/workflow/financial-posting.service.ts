import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { AccountingService } from '../accounting/accounting.service';
import { AuditService } from '../../common/audit/audit.service';
import { PolicyEngineService } from '../../common/policy/policy-engine.service';
import type { PolicyEvaluationResult } from '../../common/policy/policy.types';
import { WorkflowTaskService } from '../workflow-task/workflow-task.service';
import { OutboxService } from './outbox.service';
import { ProcessFinancialPostingDto } from './dto/process-financial-posting.dto';

export interface FinancialPostingResult {
  workflowId: string;
  journalId: string;
  taskId: string;
  policy: PolicyEvaluationResult;
  journalStatus: string;
  idempotencyKey?: string;
  timestamp: string;
}

const DEFAULT_AUTO_APPROVAL_THRESHOLD = 10_000_000;
const DEFAULT_MIN_CONFIDENCE = 0.85;

@Injectable()
export class FinancialPostingService {
  private readonly idempotencyStore = new Map<string, ApiResponse<FinancialPostingResult>>();

  constructor(
    @Inject(AccountingService) private readonly accountingService: AccountingService,
    @Inject(PolicyEngineService) private readonly policyEngine: PolicyEngineService,
    @Inject(WorkflowTaskService) private readonly workflowTaskService: WorkflowTaskService,
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

  async processFinancialPosting(
    dto: ProcessFinancialPostingDto,
    headerIdempotencyKey?: string
  ): Promise<ApiResponse<FinancialPostingResult>> {
    const idempotencyKey = headerIdempotencyKey || dto.idempotencyKey;

    if (idempotencyKey) {
      const cached = this.idempotencyStore.get(idempotencyKey);
      if (cached) {
        return cached;
      }
    }

    if (!dto.journalId) {
      throw new BadRequestException('journalId is required');
    }

    const workflowId = `wf-fp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.auditService.record({
      workflowId,
      action: 'WORKFLOW_FINANCIAL_POSTING_STARTED',
      input: { journalId: dto.journalId },
      status: 'SUCCESS'
    });

    const journalResponse = await this.accountingService.getJournal(dto.journalId);
    const journal = journalResponse.data;
    if (!journal) {
      throw new NotFoundException(`Journal [${dto.journalId}] not found`);
    }

    if (journal.status === 'POSTED') {
      throw new BadRequestException('Journal is already posted');
    }

    const entries = journal.entries ?? [];
    const totalDebit = entries
      .filter((e) => e.direction === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCredit = entries
      .filter((e) => e.direction === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0);

    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;
    const amount = totalDebit;

    const task = await this.workflowTaskService.createTask({
      workflowId,
      taskType: 'FINANCIAL_POSTING',
      maxIterations: 3,
      tokenBudget: 5000,
      timeBudgetMs: 30000,
      minConfidence: DEFAULT_MIN_CONFIDENCE,
      confidence: dto.confidence,
      payload: { journalId: journal.id, amount, isBalanced },
      idempotencyKey
    });

    if (task.status === 'FAILED' || task.status === 'TIMED_OUT') {
      const result: FinancialPostingResult = {
        workflowId,
        journalId: journal.id,
        taskId: task.id,
        policy: {
          decision: 'REJECT',
          reasons: ['Re-evaluation circuit breaker triggered before policy check'],
          evaluatedAt: new Date().toISOString()
        },
        journalStatus: journal.status,
        idempotencyKey,
        timestamp: new Date().toISOString()
      };

      const response: ApiResponse<FinancialPostingResult> = {
        success: true,
        data: result,
        metadata: this.buildMetadata()
      };
      if (idempotencyKey) {
        this.idempotencyStore.set(idempotencyKey, response);
      }
      return response;
    }

    const autoApprovalThreshold = dto.autoApprovalThreshold ?? DEFAULT_AUTO_APPROVAL_THRESHOLD;

    const policyResult = this.policyEngine.evaluateFinancialPostingPolicy({
      amount,
      isBalanced,
      autoApprovalThreshold
    });

    this.auditService.record({
      workflowId,
      action: 'WORKFLOW_FINANCIAL_POSTING_POLICY_EVALUATED',
      input: { journalId: journal.id, amount, isBalanced },
      output: policyResult,
      status: 'SUCCESS'
    });

    let journalStatus: string = journal.status;

    if (policyResult.decision === 'AUTO_APPROVE') {
      const posted = await this.accountingService.postJournal(journal.id);
      if (posted.data) {
        journalStatus = posted.data.status;
      }

      this.outboxService.publish({
        aggregateType: 'Journal',
        aggregateId: journal.id,
        eventType: 'JournalPosted',
        payload: { journalId: journal.id, amount }
      });
    } else if (policyResult.decision === 'REQUIRE_HUMAN_APPROVAL') {
      this.outboxService.publish({
        aggregateType: 'Journal',
        aggregateId: journal.id,
        eventType: 'FinancialPostingEscalated',
        payload: {
          journalId: journal.id,
          amount,
          reasons: policyResult.reasons
        }
      });
    }

    await this.workflowTaskService.completeTask(task.id, {
      policy: policyResult,
      journalStatus,
      amount
    });

    const result: FinancialPostingResult = {
      workflowId,
      journalId: journal.id,
      taskId: task.id,
      policy: policyResult,
      journalStatus,
      idempotencyKey,
      timestamp: new Date().toISOString()
    };

    const response: ApiResponse<FinancialPostingResult> = {
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
