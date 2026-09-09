export type TaskComplexity =
  | 'SIMPLE_QUERY'
  | 'SIMPLE_CLASSIFICATION'
  | 'COMPLEX_REASONING'
  | 'CRITICAL_DECISION';

export type ModelTier = 'DETERMINISTIC' | 'SMALL_MODEL' | 'REASONING_MODEL' | 'HIGH_RELIABILITY_MODEL';

export interface RoutingRequest {
  complexity: TaskComplexity;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trustRequirement: number;
  latencyRequirementMs?: number;
  availableBudgetUsd: number;
}

export interface ModelRoutingDecision {
  tier: ModelTier;
  model?: string;
  requiresPolicyValidation: boolean;
  requiresHumanApproval: boolean;
  reasons: string[];
}

export interface CompletionRequest {
  model: string;
  systemPrompt?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  estimatedCostUsd: number;
}

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  rawArguments: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required';
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  estimatedCostUsd: number;
}
