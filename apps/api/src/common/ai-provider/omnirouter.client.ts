import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import type {
  CompletionRequest,
  CompletionResult,
  ChatRequest,
  ChatResult,
  ChatMessage,
  ToolCall
} from './ai-provider.types';
import { RateLimitSupervisorService } from './rate-limit-supervisor.service';

export interface OmniRouterConfig {
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
}

const ESTIMATED_COST_PER_1K_TOKENS_USD = 0.002;

export const getOmniRouterConfig = (env: NodeJS.ProcessEnv = process.env): OmniRouterConfig => {
  const baseUrl = env.OMNIROUTER_BASE_URL || env.API_URL_AI_PROVIDER;
  const apiKey = env.OMNIROUTER_API_KEY || env.PROVIDER_API_KEY;
  return {
    baseUrl,
    apiKey,
    enabled: Boolean(baseUrl && apiKey)
  };
};

@Injectable()
export class OmniRouterClient {
  constructor(
    @Optional() @Inject(RateLimitSupervisorService)
    private readonly rateLimitSupervisor?: RateLimitSupervisorService
  ) {}

  private toWireMessage(message: ChatMessage): Record<string, unknown> {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.toolCallId,
        name: message.name,
        content: message.content ?? ''
      };
    }

    if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: message.content,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.rawArguments }
        }))
      };
    }

    return { role: message.role, content: message.content ?? '' };
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    if (this.rateLimitSupervisor && this.rateLimitSupervisor.isPaused()) {
      const status = this.rateLimitSupervisor.getStatus();
      throw new ServiceUnavailableException(
        `AI provider is currently paused due to rate limit cooldown. Remaining: ${status.cooldownRemainingSeconds}s.`
      );
    }

    const config = getOmniRouterConfig();
    const startedAt = Date.now();

    if (!config.enabled) {
      throw new ServiceUnavailableException(
        'AI provider is not configured. Set OMNIROUTER_BASE_URL/API_URL_AI_PROVIDER and OMNIROUTER_API_KEY/PROVIDER_API_KEY.'
      );
    }

    const payload: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.2,
      messages: request.messages.map((m) => this.toWireMessage(m))
    };

    if (request.tools && request.tools.length > 0) {
      payload.tools = request.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
      payload.tool_choice = request.toolChoice ?? 'auto';
    }

    const response = await fetch(`${config.baseUrl!.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    }).catch((err) => {
      throw new ServiceUnavailableException(`AI provider network error: ${err.message}`);
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) || 30 : 30;
        this.rateLimitSupervisor?.recordRateLimit(request.model, retryAfterSeconds);
      }
      const errorBody = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `AI provider request failed with status ${response.status}: ${errorBody.slice(0, 500)}`
      );
    }

    const body = (await response.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: {
          content?: string | null;
          tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const choice = body.choices?.[0];
    const rawToolCalls = choice?.message?.tool_calls ?? [];

    const toolCalls: ToolCall[] = rawToolCalls.map((call, index) => {
      const rawArguments = call.function?.arguments ?? '{}';
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(rawArguments || '{}');
      } catch {
        parsed = {};
      }
      return {
        id: call.id ?? `call_${index}`,
        name: call.function?.name ?? 'unknown',
        arguments: parsed,
        rawArguments
      };
    });

    const content = choice?.message?.content ?? null;
    const inputTokens = body.usage?.prompt_tokens ?? 0;
    const outputTokens = body.usage?.completion_tokens ?? 0;
    const latencyMs = Date.now() - startedAt;
    const estimatedCostUsd = ((inputTokens + outputTokens) / 1000) * ESTIMATED_COST_PER_1K_TOKENS_USD;

    return {
      content,
      toolCalls,
      finishReason: choice?.finish_reason ?? 'stop',
      inputTokens,
      outputTokens,
      model: request.model,
      latencyMs,
      estimatedCostUsd
    };
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (this.rateLimitSupervisor && this.rateLimitSupervisor.isPaused()) {
      const status = this.rateLimitSupervisor.getStatus();
      throw new ServiceUnavailableException(
        `AI provider is currently paused due to rate limit cooldown. Remaining: ${status.cooldownRemainingSeconds}s.`
      );
    }

    const config = getOmniRouterConfig();
    const startedAt = Date.now();

    if (!config.enabled) {
      throw new ServiceUnavailableException(
        'AI provider is not configured. Set OMNIROUTER_BASE_URL/API_URL_AI_PROVIDER and OMNIROUTER_API_KEY/PROVIDER_API_KEY.'
      );
    }

    const response = await fetch(`${config.baseUrl!.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.2,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt }
        ]
      })
    }).catch((err) => {
      throw new ServiceUnavailableException(`AI provider network error: ${err.message}`);
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) || 30 : 30;
        this.rateLimitSupervisor?.recordRateLimit(request.model, retryAfterSeconds);
      }
      const errorBody = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `AI provider request failed with status ${response.status}: ${errorBody.slice(0, 500)}`
      );
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = body.choices?.[0]?.message?.content ?? '';
    const inputTokens = body.usage?.prompt_tokens ?? Math.ceil(request.prompt.length / 4);
    const outputTokens = body.usage?.completion_tokens ?? Math.ceil(content.length / 4);
    const latencyMs = Date.now() - startedAt;
    const estimatedCostUsd = ((inputTokens + outputTokens) / 1000) * ESTIMATED_COST_PER_1K_TOKENS_USD;

    return {
      content,
      inputTokens,
      outputTokens,
      model: request.model,
      latencyMs,
      estimatedCostUsd
    };
  }
}
