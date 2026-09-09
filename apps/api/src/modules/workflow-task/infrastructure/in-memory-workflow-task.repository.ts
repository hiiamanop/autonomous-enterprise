import { Injectable } from '@nestjs/common';
import type { WorkflowTask } from '../domain/workflow-task.types';
import type { IWorkflowTaskRepository } from '../domain/workflow-task.repository.interface';

@Injectable()
export class InMemoryWorkflowTaskRepository implements IWorkflowTaskRepository {
  private tasks: WorkflowTask[] = [];

  async createTask(task: WorkflowTask): Promise<WorkflowTask> {
    this.tasks.push(task);
    return task;
  }

  async updateTask(task: WorkflowTask): Promise<WorkflowTask> {
    const index = this.tasks.findIndex((t) => t.id === task.id);
    if (index === -1) {
      throw new Error(`WorkflowTask ${task.id} not found`);
    }
    this.tasks[index] = task;
    return task;
  }

  async findTaskById(id: string): Promise<WorkflowTask | null> {
    return this.tasks.find((t) => t.id === id) ?? null;
  }

  async findTasksByWorkflow(workflowId: string): Promise<WorkflowTask[]> {
    return this.tasks.filter((t) => t.workflowId === workflowId);
  }
}
