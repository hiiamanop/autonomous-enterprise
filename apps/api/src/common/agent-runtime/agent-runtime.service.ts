import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { OmniRouterClient } from '../ai-provider/omnirouter.client';
import { RateLimitSupervisorService } from '../ai-provider/rate-limit-supervisor.service';
import { AiBudgetService } from '../../modules/ai-budget/ai-budget.service';
import { AuditService } from '../audit/audit.service';
import type { ChatMessage, ToolDefinition } from '../ai-provider/ai-provider.types';
import type { AgentTool, AgentRunResult, ToolInvocationRecord } from './agent-tool.types';

export interface AgentRunOptions {
  agentName: string;
  systemPrompt: string;
  objective: string;
  tools: AgentTool[];
  maxIterations?: number;
  maxCostUsd?: number;
  model?: string;
  temperature?: number;
  isAborted?: () => boolean;
  onToolInvoked?: (record: ToolInvocationRecord) => void;
  onThought?: (thought: string, step: number) => void;
}

@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);

  constructor(
    @Optional() @Inject(OmniRouterClient) private readonly omniRouter?: OmniRouterClient,
    @Optional() @Inject(AiBudgetService) private readonly aiBudget?: AiBudgetService,
    @Optional() @Inject(AuditService) private readonly auditService?: AuditService,
    @Optional() @Inject(RateLimitSupervisorService)
    private readonly rateLimitSupervisor?: RateLimitSupervisorService
  ) {}

  private toToolDefinitions(tools: AgentTool[]): ToolDefinition[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: `${tool.description} [effect: ${tool.sideEffect}]`,
      parameters: tool.parameters
    }));
  }

  private truncate(value: unknown, limit = 1200): string {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (!text) return 'null';
    return text.length > limit ? `${text.slice(0, limit)}... [truncated]` : text;
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const startedAt = new Date().toISOString();
    const model = options.model || process.env.AI_MODEL_REASONING || 'Infrastructure';
    const maxIterations = options.maxIterations ?? 6;
    const maxCostUsd = options.maxCostUsd ?? 0.05;

    const toolMap = new Map(options.tools.map((t) => [t.name, t]));
    const toolCalls: ToolInvocationRecord[] = [];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    let writesPerformed = 0;
    let iterations = 0;
    let finalAnswer = '';
    let stopReason: AgentRunResult['stopReason'] = 'COMPLETED';

    const baseResult = (): AgentRunResult => ({
      agentName: options.agentName,
      objective: options.objective,
      finalAnswer,
      iterations,
      toolCalls,
      writesPerformed,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      stopReason,
      model,
      startedAt,
      finishedAt: new Date().toISOString()
    });

    if (!this.omniRouter) {
      finalAnswer = '[AGENT DISABLED] No AI provider configured — agent cannot reason or act.';
      stopReason = 'PROVIDER_ERROR';
      return baseResult();
    }

    if (options.tools.length === 0) {
      finalAnswer = '[NO TOOLS] Agent has no tools available.';
      stopReason = 'NO_TOOLS';
      return baseResult();
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.objective }
    ];

    const toolDefs = this.toToolDefinitions(options.tools);

    while (iterations < maxIterations) {
      if (options.isAborted?.()) {
        stopReason = 'CANCELLED';
        finalAnswer = '[CANCELLED] Agent run aborted.';
        break;
      }

      iterations += 1;

      if (totalCostUsd >= maxCostUsd) {
        stopReason = 'BUDGET_EXCEEDED';
        finalAnswer =
          finalAnswer ||
          `[BUDGET STOP] Agent halted after ${iterations - 1} steps: cost $${totalCostUsd.toFixed(5)} reached cap $${maxCostUsd}.`;
        break;
      }

      let response;
      try {
        response = await this.omniRouter.chat({
          model,
          messages,
          tools: toolDefs,
          toolChoice: 'auto',
          maxTokens: 600,
          temperature: options.temperature ?? 0.2
        });
      } catch (err: any) {
        this.logger.warn(`[${options.agentName}] provider error: ${err?.message}`);
        if (err?.status === 429 || String(err?.message).includes('429')) {
          this.rateLimitSupervisor?.recordRateLimit(model, 30);
        }
        stopReason = 'PROVIDER_ERROR';
        finalAnswer = `[PROVIDER ERROR] ${err?.message ?? 'unknown'}`;
        break;
      }

      if (options.isAborted?.()) {
        stopReason = 'CANCELLED';
        finalAnswer = '[CANCELLED] Agent run aborted after model response.';
        break;
      }

      totalInputTokens += response.inputTokens;
      totalOutputTokens += response.outputTokens;
      totalCostUsd += response.estimatedCostUsd;

      if (this.aiBudget) {
        await this.aiBudget
          .recordUsage({
            agentName: options.agentName,
            model,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            estimatedCostUsd: response.estimatedCostUsd,
            latencyMs: response.latencyMs
          })
          .catch(() => null);
      }

      if (response.content && options.onThought) {
        options.onThought(response.content, iterations);
      }

      if (response.toolCalls.length === 0) {
        finalAnswer = response.content?.trim() || '[EMPTY] Agent produced no answer.';
        stopReason = 'COMPLETED';
        break;
      }

      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls
      });

      for (const call of response.toolCalls) {
        if (options.isAborted?.()) {
          stopReason = 'CANCELLED';
          break;
        }

        const tool = toolMap.get(call.name);
        const invokeStart = Date.now();
        const record: ToolInvocationRecord = {
          step: iterations,
          toolName: call.name,
          sideEffect: tool?.sideEffect ?? 'READ',
          arguments: call.arguments,
          result: null,
          ok: false,
          durationMs: 0,
          startedAt: new Date().toISOString()
        };

        if (!tool) {
          record.error = `Unknown tool "${call.name}"`;
          record.result = { error: record.error };
        } else {
          try {
            const result = await tool.execute(call.arguments);
            record.result = result;
            record.ok = true;
            if (tool.sideEffect !== 'READ') {
              writesPerformed += 1;
            }
          } catch (err: any) {
            record.error = err?.message ?? 'tool execution failed';
            record.result = { error: record.error };
          }
        }

        record.durationMs = Date.now() - invokeStart;
        toolCalls.push(record);
        options.onToolInvoked?.(record);

        this.logger.log(
          `[${options.agentName}] step ${iterations} tool=${call.name} effect=${record.sideEffect} ok=${record.ok} args=${this.truncate(call.arguments, 200)}`
        );

        messages.push({
          role: 'tool',
          toolCallId: call.id,
          name: call.name,
          content: this.truncate(record.result)
        });
      }

      if (iterations >= maxIterations) {
        stopReason = 'MAX_ITERATIONS';
        finalAnswer =
          finalAnswer ||
          `[ITERATION LIMIT] Agent reached ${maxIterations} steps after ${toolCalls.length} tool calls.`;
      }
    }

    const result = baseResult();

    this.auditService?.record({
      agent: options.agentName,
      action: 'AGENT_RUN_COMPLETED',
      input: { objective: options.objective, toolsAvailable: options.tools.map((t) => t.name) },
      output: {
        stopReason: result.stopReason,
        iterations: result.iterations,
        toolCalls: result.toolCalls.map((t) => ({ tool: t.toolName, ok: t.ok, effect: t.sideEffect })),
        writesPerformed: result.writesPerformed,
        costUsd: result.totalCostUsd
      },
      status: result.stopReason === 'COMPLETED' ? 'SUCCESS' : 'FAILURE',
      reasoning: result.finalAnswer
    });

    return result;
  }
}
