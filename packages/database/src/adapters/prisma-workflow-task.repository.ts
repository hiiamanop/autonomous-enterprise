import type { PrismaClient, WorkflowTask as PrismaWorkflowTask } from '@prisma/client';

export interface WorkflowTaskEntity {
  id: string;
  workflowId: string;
  taskType: string;
  status: string;
  maxIterations?: number;
  iterationCount?: number;
  tokenBudget?: number;
  tokenUsed?: number;
  timeBudgetMs?: number;
  minConfidence?: number;
  confidence?: number;
  deadline?: string;
  payload?: unknown;
  result?: unknown;
  error?: string;
  claimedBy?: string;
  claimedAt?: string;
  heartbeatAt?: string;
  retries?: number;
  maxRetries?: number;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export class PrismaWorkflowTaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapTask(raw: PrismaWorkflowTask): WorkflowTaskEntity {
    return {
      id: raw.id,
      workflowId: raw.workflowId,
      taskType: raw.taskType,
      status: raw.status,
      retries: raw.retries,
      maxRetries: raw.maxRetries,
      claimedBy: raw.claimedBy ?? undefined,
      claimedAt: raw.claimedAt ? raw.claimedAt.toISOString() : undefined,
      heartbeatAt: raw.heartbeatAt ? raw.heartbeatAt.toISOString() : undefined,
      idempotencyKey: raw.idempotencyKey ?? undefined,
      error: raw.error ?? undefined,
      payload: raw.payload ?? undefined,
      result: raw.result ?? undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async createTask(task: WorkflowTaskEntity): Promise<WorkflowTaskEntity> {
    const raw = await this.prisma.workflowTask.create({
      data: {
        id: task.id,
        workflowId: task.workflowId,
        taskType: task.taskType,
        status: task.status as never,
        retries: task.retries ?? 0,
        maxRetries: task.maxRetries ?? 3,
        claimedBy: task.claimedBy,
        claimedAt: task.claimedAt ? new Date(task.claimedAt) : undefined,
        heartbeatAt: task.heartbeatAt ? new Date(task.heartbeatAt) : undefined,
        idempotencyKey: task.idempotencyKey,
        payload: (task.payload ?? {}) as never,
        result: (task.result ?? undefined) as never,
        error: task.error,
        createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : undefined
      }
    });
    return this.mapTask(raw);
  }

  async updateTask(task: WorkflowTaskEntity): Promise<WorkflowTaskEntity> {
    const raw = await this.prisma.workflowTask.update({
      where: { id: task.id },
      data: {
        status: task.status as never,
        retries: task.retries,
        claimedBy: task.claimedBy,
        claimedAt: task.claimedAt ? new Date(task.claimedAt) : undefined,
        heartbeatAt: task.heartbeatAt ? new Date(task.heartbeatAt) : undefined,
        result: (task.result ?? undefined) as never,
        error: task.error,
        updatedAt: new Date()
      }
    });
    return this.mapTask(raw);
  }

  async findTaskById(id: string): Promise<WorkflowTaskEntity | null> {
    const raw = await this.prisma.workflowTask.findUnique({
      where: { id }
    });
    return raw ? this.mapTask(raw) : null;
  }

  async findTasksByWorkflow(workflowId: string): Promise<WorkflowTaskEntity[]> {
    const tasks = await this.prisma.workflowTask.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'asc' }
    });
    return tasks.map((t) => this.mapTask(t));
  }
}
