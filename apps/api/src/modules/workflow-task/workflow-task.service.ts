import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { WorkflowTask, WorkflowTaskStatus } from './domain/workflow-task.types';
import {
  WORKFLOW_TASK_REPOSITORY,
  type IWorkflowTaskRepository
} from './domain/workflow-task.repository.interface';
import { AuditService } from '../../common/audit/audit.service';
import { TicketingService } from '../ticketing/ticketing.service';

export interface TaskLimits {
  maxIterations: number;
  tokenBudget: number;
  timeBudgetMs: number;
  minConfidence: number;
}

export const DEFAULT_TASK_LIMITS: TaskLimits = {
  maxIterations: 3,
  tokenBudget: 5000,
  timeBudgetMs: 10000,
  minConfidence: 0.85
};

export interface ReEvaluationOutcome {
  task: WorkflowTask;
  outcome: 'EXECUTE' | 'RETRY' | 'CIRCUIT_BROKEN';
  ticketId?: string;
}

@Injectable()
export class WorkflowTaskService {
  constructor(
    @Inject(WORKFLOW_TASK_REPOSITORY) private readonly repository: IWorkflowTaskRepository,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(TicketingService) private readonly ticketingService: TicketingService
  ) {}

  async createTask(
    workflowIdOrObj: string | { workflowId: string; taskType: string; maxIterations?: number; tokenBudget?: number; timeBudgetMs?: number; minConfidence?: number; confidence?: number; payload?: unknown; idempotencyKey?: string },
    taskTypeArg?: string,
    limitsArg: Partial<TaskLimits> = {},
    payloadArg?: unknown
  ): Promise<WorkflowTask> {
    let workflowId: string;
    let taskType: string;
    let limits: Partial<TaskLimits> = {};
    let payload: unknown;
    let confidence: number | undefined;
    let idempotencyKey: string | undefined;

    if (typeof workflowIdOrObj === 'object' && workflowIdOrObj !== null) {
      workflowId = workflowIdOrObj.workflowId;
      taskType = workflowIdOrObj.taskType;
      limits = {
        maxIterations: workflowIdOrObj.maxIterations,
        tokenBudget: workflowIdOrObj.tokenBudget,
        timeBudgetMs: workflowIdOrObj.timeBudgetMs,
        minConfidence: workflowIdOrObj.minConfidence
      };
      confidence = workflowIdOrObj.confidence;
      payload = workflowIdOrObj.payload;
      idempotencyKey = workflowIdOrObj.idempotencyKey;
    } else {
      workflowId = workflowIdOrObj;
      taskType = taskTypeArg!;
      limits = limitsArg;
      payload = payloadArg;
    }

    const resolvedLimits = { ...DEFAULT_TASK_LIMITS, ...limits };
    const now = new Date().toISOString();

    const task: WorkflowTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workflowId,
      taskType,
      status: 'PENDING',
      maxIterations: resolvedLimits.maxIterations,
      iterationCount: 0,
      tokenBudget: resolvedLimits.tokenBudget,
      tokenUsed: 0,
      timeBudgetMs: resolvedLimits.timeBudgetMs,
      minConfidence: resolvedLimits.minConfidence,
      confidence,
      deadline: new Date(Date.now() + resolvedLimits.timeBudgetMs).toISOString(),
      payload,
      idempotencyKey,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.repository.createTask(task);

    this.auditService.record({
      workflowId,
      action: 'WORKFLOW_TASK_CREATED',
      input: { taskType, limits: resolvedLimits },
      status: 'SUCCESS'
    });

    return saved;
  }

  async recordAttempt(taskId: string, confidence: number, tokenUsed: number): Promise<ReEvaluationOutcome> {
    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`WorkflowTask [${taskId}] not found`);
    }

    task.iterationCount = (task.iterationCount ?? 0) + 1;
    task.tokenUsed = (task.tokenUsed ?? 0) + tokenUsed;
    task.confidence = confidence;
    task.updatedAt = new Date().toISOString();

    const isPastDeadline = task.deadline ? new Date().getTime() > new Date(task.deadline).getTime() : false;
    const isIterationsExceeded = task.iterationCount >= (task.maxIterations ?? DEFAULT_TASK_LIMITS.maxIterations);
    const isTokensExceeded = task.tokenUsed >= (task.tokenBudget ?? DEFAULT_TASK_LIMITS.tokenBudget);

    if (isPastDeadline || isIterationsExceeded || isTokensExceeded) {
      if (task.status === 'ESCALATED') {
        await this.repository.updateTask(task);
        return { task, outcome: 'CIRCUIT_BROKEN', ticketId: task.escalationTicketId };
      }

      task.status = 'ESCALATED';
      await this.repository.updateTask(task);

      const circuitBreakerReasons: string[] = [];
      if (isPastDeadline) circuitBreakerReasons.push('Time budget expired');
      if (isIterationsExceeded) circuitBreakerReasons.push(`Max iterations (${task.maxIterations}) reached`);
      if (isTokensExceeded) circuitBreakerReasons.push(`Token budget (${task.tokenBudget}) exceeded`);

      const ticket = await this.ticketingService.createSystemTicket(
        `Circuit Breaker: Task ${task.id} (${task.taskType}) failed bounds`,
        `Autonomous agent execution exceeded safety boundaries: ${circuitBreakerReasons.join('; ')}. State persisted for human review.`,
        'CircuitBreaker',
        'HIGH' as any,
        task.workflowId
      );

      task.escalationTicketId = ticket.id;
      await this.repository.updateTask(task);

      this.auditService.record({
        workflowId: task.workflowId,
        action: 'CIRCUIT_BREAKER_TRIGGERED',
        input: { taskId: task.id, iterationCount: task.iterationCount, tokenUsed: task.tokenUsed },
        output: { ticketId: ticket.id, reasons: circuitBreakerReasons },
        status: 'FAILURE',
        reasoning: circuitBreakerReasons.join(', ')
      });

      return { task, outcome: 'CIRCUIT_BROKEN', ticketId: ticket.id };
    }

    if (confidence < (task.minConfidence ?? DEFAULT_TASK_LIMITS.minConfidence)) {
      task.status = 'IN_PROGRESS';
      await this.repository.updateTask(task);

      this.auditService.record({
        workflowId: task.workflowId,
        action: 'TASK_REEVALUATION_REQUESTED',
        input: { taskId: task.id, confidence, minConfidence: task.minConfidence },
        status: 'SUCCESS'
      });

      return { task, outcome: 'RETRY' };
    }

    task.status = 'COMPLETED';
    await this.repository.updateTask(task);
    return { task, outcome: 'EXECUTE' };
  }

  async getTask(taskId: string): Promise<WorkflowTask> {
    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`WorkflowTask [${taskId}] not found`);
    }
    return task;
  }

  async completeTask(taskId: string, result?: unknown): Promise<WorkflowTask> {
    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`WorkflowTask [${taskId}] not found`);
    }

    task.status = 'COMPLETED';
    task.result = result;
    task.updatedAt = new Date().toISOString();

    const saved = await this.repository.updateTask(task);

    this.auditService.record({
      workflowId: task.workflowId,
      action: 'WORKFLOW_TASK_COMPLETED',
      input: { taskId: task.id },
      output: result,
      status: 'SUCCESS'
    });

    return saved;
  }

  async failTask(taskId: string, reason: string): Promise<WorkflowTask> {
    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`WorkflowTask [${taskId}] not found`);
    }

    task.status = 'FAILED';
    task.result = { error: reason };
    task.updatedAt = new Date().toISOString();

    const saved = await this.repository.updateTask(task);

    this.auditService.record({
      workflowId: task.workflowId,
      action: 'WORKFLOW_TASK_FAILED',
      input: { taskId: task.id, reason },
      status: 'FAILURE',
      reasoning: reason
    });

    return saved;
  }
}
