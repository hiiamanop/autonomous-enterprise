import type { WorkflowTask } from './workflow-task.types';

export interface IWorkflowTaskRepository {
  createTask(task: WorkflowTask): Promise<WorkflowTask>;
  updateTask(task: WorkflowTask): Promise<WorkflowTask>;
  findTaskById(id: string): Promise<WorkflowTask | null>;
  findTasksByWorkflow(workflowId: string): Promise<WorkflowTask[]>;
}

export const WORKFLOW_TASK_REPOSITORY = 'WORKFLOW_TASK_REPOSITORY';
