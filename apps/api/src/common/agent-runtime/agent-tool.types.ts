import type { ToolDefinition } from '../ai-provider/ai-provider.types';

export type ToolSideEffect = 'READ' | 'WRITE' | 'CRITICAL_WRITE';

export interface AgentTool {
  name: string;
  description: string;
  sideEffect: ToolSideEffect;
  parameters: ToolDefinition['parameters'];
  execute(args: Record<string, unknown>): Promise<unknown>;
}

export interface ToolInvocationRecord {
  step: number;
  toolName: string;
  sideEffect: ToolSideEffect;
  arguments: Record<string, unknown>;
  result: unknown;
  ok: boolean;
  error?: string;
  durationMs: number;
  startedAt: string;
}

export interface AgentRunResult {
  agentName: string;
  objective: string;
  finalAnswer: string;
  iterations: number;
  toolCalls: ToolInvocationRecord[];
  writesPerformed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  stopReason: 'COMPLETED' | 'MAX_ITERATIONS' | 'BUDGET_EXCEEDED' | 'PROVIDER_ERROR' | 'NO_TOOLS' | 'CANCELLED';
  model: string;
  startedAt: string;
  finishedAt: string;
}
