import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { SalesChannel } from '@autonomous-enterprise/contracts';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import { EventStreamService } from '../../common/events/event-stream.service';
import { AuditService } from '../../common/audit/audit.service';
import { RateLimitSupervisorService } from '../../common/ai-provider/rate-limit-supervisor.service';
import { OmniRouterClient } from '../../common/ai-provider/omnirouter.client';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { AgentRegistryService } from '../agent-registry/agent-registry.service';
import { AiBudgetService } from '../ai-budget/ai-budget.service';
import { SalesService } from '../sales/sales.service';
import { InventoryService } from '../inventory/inventory.service';
import { HrisService } from '../hris/hris.service';
import { InfrastructureService } from '../infrastructure/infrastructure.service';
import { AgentRuntimeService } from '../../common/agent-runtime/agent-runtime.service';
import { EnterpriseToolsFactory } from '../../common/agent-runtime/enterprise-tools.factory';
import { ordersPerMinuteFrom, planCapacity, REPLICA_HOURLY_COST_USD } from './capacity-planner';
import type { SimulatorConfigDto, SimulatorStatus, TrafficMode } from './simulator.types';

const AGENT_PERSONAS: Record<string, { role: string; desk: string; color: string }> = {
  'sales-agent': { role: 'Sales & Inbound Lead', desk: 'Sales Desk', color: '#3b82f6' },
  'inventory-agent': { role: 'Stock & Warehouse Custodian', desk: 'Warehouse Bay', color: '#10b981' },
  'finance-agent': { role: 'Treasury & Budget Gatekeeper', desk: 'Finance Suite', color: '#f59e0b' },
  'hris-agent': { role: 'People & Capacity Manager', desk: 'HR Lounge', color: '#8b5cf6' },
  'infra-agent': { role: 'K8s Cluster Controller', desk: 'Server Room', color: '#ec4899' },
  'orchestrator': { role: 'Macro Enterprise Orchestrator', desk: 'Central Hub', color: '#6366f1' },
  'debugger-agent': { role: 'System Consistency & Compliance Auditor', desk: 'War Room', color: '#06b6d4' },
  'tester-agent': { role: 'Contract & Synthetic Verification Tester', desk: 'Verification Bay', color: '#14b8a6' }
};

@Injectable()
export class SimulatorService implements OnModuleDestroy {
  private readonly logger = new Logger(SimulatorService.name);
  private isRunning = false;
  private isExecutingStep = false;
  private activeAbort = false;
  private mode: TrafficMode = 'NORMAL';
  private intervalMs = 3000;
  private autoAiReasoning = true;
  private totalTicks = 0;
  private successfulActions = 0;
  private failedActions = 0;
  private lastAction?: string;
  private lastActor?: string;
  private lastSpeechBubble?: string;
  private lastTimestamp?: string;
  private timer: NodeJS.Timeout | null = null;
  private currentTenantId = 'tenant-corp';
  private actionCursor = 0;

  constructor(
    @Optional() @Inject(EventStreamService) private readonly eventStream?: EventStreamService,
    @Optional() @Inject(AuditService) private readonly auditService?: AuditService,
    @Optional() @Inject(RateLimitSupervisorService) private readonly rateLimitSupervisor?: RateLimitSupervisorService,
    @Optional() @Inject(OmniRouterClient) private readonly omniRouter?: OmniRouterClient,
    @Optional() @Inject(OrchestratorService) private readonly orchestrator?: OrchestratorService,
    @Optional() @Inject(AgentRegistryService) private readonly agentRegistry?: AgentRegistryService,
    @Optional() @Inject(AiBudgetService) private readonly aiBudget?: AiBudgetService,
    @Optional() @Inject(SalesService) private readonly salesService?: SalesService,
    @Optional() @Inject(InventoryService) private readonly inventoryService?: InventoryService,
    @Optional() @Inject(HrisService) private readonly hrisService?: HrisService,
    @Optional() @Inject(InfrastructureService) private readonly infraService?: InfrastructureService,
    @Optional() @Inject(AgentRuntimeService) private readonly agentRuntime?: AgentRuntimeService,
    @Optional() @Inject(EnterpriseToolsFactory) private readonly toolsFactory?: EnterpriseToolsFactory
  ) {}

  private agentMode = process.env.SIMULATOR_AGENT_MODE !== 'false';

  private seededCustomerId: string | null = null;
  private seededWarehouseId: string | null = null;
  private seededProductIds: string[] = [];
  private seededDepartmentId: string | null = null;
  private seededWarehouseEmployeeIds: string[] = [];
  private seededSalesRepIds: string[] = [];

  private async ensureSalesRepSeedData(): Promise<void> {
    if (!this.salesService) return;
    if (this.seededSalesRepIds.length > 0) return;

    try {
      const existing = await this.salesService.listSalesReps();
      if ((existing.data ?? []).length > 0) {
        this.seededSalesRepIds = (existing.data ?? []).map((r) => r.id);
        return;
      }

      const roster = [
        { fullName: 'Rina Kartika', territory: 'Jakarta', quotaMonthlyUsd: 12000 },
        { fullName: 'Bayu Pratama', territory: 'Surabaya', quotaMonthlyUsd: 9000 },
        { fullName: 'Maya Anggraini', territory: 'Bandung', quotaMonthlyUsd: 8000 }
      ];

      for (const person of roster) {
        const created = await this.salesService.createSalesRep({
          fullName: person.fullName,
          email: `${person.fullName.toLowerCase().replace(/\s+/g, '.')}@autonomous.test`,
          territory: person.territory,
          quotaMonthlyUsd: person.quotaMonthlyUsd
        });
        if (created.data?.id) {
          this.seededSalesRepIds.push(created.data.id);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Sales rep seed data setup skipped: ${err?.message}`);
    }
  }

  private async ensureWorkforceSeedData(): Promise<void> {
    if (!this.hrisService) return;
    if (this.seededDepartmentId && this.seededWarehouseEmployeeIds.length > 0) return;

    try {
      const departments = await this.hrisService.listDepartments();
      const existing = (departments.data ?? []).find((d) => d.name === 'Warehouse Operations');

      if (existing) {
        this.seededDepartmentId = existing.id;
      } else {
        const created = await this.hrisService.createDepartment({ name: 'Warehouse Operations' });
        this.seededDepartmentId = created.data?.id ?? null;
      }

      if (!this.seededDepartmentId) return;

      const employees = await this.hrisService.listEmployees(this.seededDepartmentId);
      const deptEmployees = employees.data ?? [];

      if (deptEmployees.length > 0) {
        this.seededWarehouseEmployeeIds = deptEmployees.map((e) => e.id);
      } else {
        const staff = [
          { fullName: 'Budi Santoso', position: 'Warehouse Picker', hourlyRate: 8.5 },
          { fullName: 'Siti Rahayu', position: 'Warehouse Packer', hourlyRate: 8.5 },
          { fullName: 'Andi Wijaya', position: 'Courier', hourlyRate: 9.0 },
          { fullName: 'Dewi Lestari', position: 'Courier', hourlyRate: 9.0 }
        ];

        for (const person of staff) {
          const created = await this.hrisService.createEmployee({
            departmentId: this.seededDepartmentId,
            fullName: person.fullName,
            email: `${person.fullName.toLowerCase().replace(/\s+/g, '.')}@autonomous.test`,
            position: person.position,
            hourlyRate: person.hourlyRate
          });
          if (created.data?.id) {
            this.seededWarehouseEmployeeIds.push(created.data.id);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Workforce seed data setup skipped: ${err?.message}`);
    }
  }

  private async ensureBusinessSeedData(): Promise<void> {
    if (!this.salesService || !this.inventoryService) return;
    if (this.seededCustomerId && this.seededWarehouseId && this.seededProductIds.length > 0) return;

    try {
      const customers = await this.salesService.listCustomers();
      if (customers.data && customers.data.length > 0) {
        this.seededCustomerId = customers.data[0].id;
      } else {
        const created = await this.salesService.createCustomer({
          name: 'Acme Autonomous Corp',
          email: 'ops@acme-autonomous.test',
          phone: '+62-800-1000',
          address: 'Jakarta Enterprise District'
        });
        this.seededCustomerId = created.data?.id ?? null;
      }

      const warehouses = await this.inventoryService.listWarehouses();
      if (warehouses.data && warehouses.data.length > 0) {
        this.seededWarehouseId = warehouses.data[0].id;
      } else {
        const created = await this.inventoryService.createWarehouse({
          code: 'WH-MAIN',
          name: 'Main Distribution Bay',
          location: 'Jakarta'
        });
        this.seededWarehouseId = created.data?.id ?? null;
      }

      const products = await this.inventoryService.listProducts();
      if (products.data && products.data.length > 0) {
        this.seededProductIds = products.data.map((p) => p.id);
      } else {
        const catalog = [
          { sku: 'SKU-PREMIUM-A', name: 'Premium Widget A', price: 149.0 },
          { sku: 'SKU-STANDARD-B', name: 'Standard Widget B', price: 79.5 },
          { sku: 'SKU-MICRO-C', name: 'Micro Component C', price: 24.75 }
        ];

        for (const entry of catalog) {
          const created = await this.inventoryService.createProduct(entry);
          if (created.data?.id) {
            this.seededProductIds.push(created.data.id);
            if (this.seededWarehouseId) {
              await this.inventoryService
                .setStock({
                  warehouseId: this.seededWarehouseId,
                  productId: created.data.id,
                  quantity: 5000,
                  notes: 'Initial autonomous simulator stock'
                })
                .catch(() => null);
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Business seed data setup skipped: ${err?.message}`);
    }
  }

  getStatus(): SimulatorStatus {
    const rateLimit = this.rateLimitSupervisor?.getStatus();
    return {
      isRunning: this.isRunning,
      mode: this.mode,
      intervalMs: this.intervalMs,
      totalTicks: this.totalTicks,
      successfulActions: this.successfulActions,
      failedActions: this.failedActions,
      pausedByRateLimit: Boolean(rateLimit?.isRateLimited),
      rateLimitCooldownSeconds: rateLimit?.cooldownRemainingSeconds ?? 0,
      lastAction: this.lastAction,
      lastActor: this.lastActor,
      lastSpeechBubble: this.lastSpeechBubble,
      lastTimestamp: this.lastTimestamp
    };
  }

  start(config?: SimulatorConfigDto): SimulatorStatus {
    if (config?.mode) this.mode = config.mode;
    if (config?.intervalMs) this.intervalMs = Math.max(1000, config.intervalMs);
    if (config?.autoAiReasoning !== undefined) this.autoAiReasoning = config.autoAiReasoning;

    this.activeAbort = false;

    if (this.isRunning) {
      if (!this.isExecutingStep && !this.timer) {
        this.restartTimer();
      }
      return this.getStatus();
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isRunning = true;
    this.logger.log(`Starting continuous traffic simulator in [${this.mode}] mode every ${this.intervalMs}ms`);

    this.emitOfficeEvent({
      action: 'SIMULATOR_STARTED',
      actor: 'system',
      target: 'orchestrator',
      speechBubble: `Traffic simulator active [${this.mode}]. Autonomous office is live!`,
      mood: 'happy'
    });

    this.timer = setTimeout(() => this.tick(), 100);

    return this.getStatus();
  }

  stop(): SimulatorStatus {
    this.isRunning = false;
    this.activeAbort = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isExecutingStep = false;
    this.logger.log('Traffic simulator stopped.');

    this.emitOfficeEvent({
      action: 'SIMULATOR_STOPPED',
      actor: 'system',
      target: 'orchestrator',
      speechBubble: 'Traffic simulator stopped. Office standing by in idle mode.',
      mood: 'neutral'
    });

    return this.getStatus();
  }

  updateConfig(config: SimulatorConfigDto): SimulatorStatus {
    if (config.mode) this.mode = config.mode;
    if (config.intervalMs) this.intervalMs = Math.max(1000, config.intervalMs);
    if (config.autoAiReasoning !== undefined) this.autoAiReasoning = config.autoAiReasoning;

    if (this.isRunning && !this.isExecutingStep) {
      this.restartTimer();
    }
    return this.getStatus();
  }

  private restartTimer(): void {
    if (!this.isRunning || this.activeAbort) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timer = setTimeout(() => this.tick(), this.intervalMs);
  }

  private async tick(): Promise<void> {
    if (!this.isRunning || this.activeAbort) {
      this.isExecutingStep = false;
      return;
    }

    if (this.isExecutingStep) {
      return;
    }

    this.isExecutingStep = true;
    this.totalTicks += 1;

    try {
      const isRateLimited = this.rateLimitSupervisor?.isPaused();
      if (isRateLimited) {
        const rlStatus = this.rateLimitSupervisor?.getStatus();
        this.emitOfficeEvent({
          action: 'SIMULATOR_PAUSED_BY_RATELIMIT',
          actor: 'orchestrator',
          target: 'all',
          speechBubble: `Rate limit cooldown active (${rlStatus?.cooldownRemainingSeconds}s remaining). All agent desks paused.`,
          mood: 'warning'
        });
        return;
      }

      await this.executeSimulatedStep();
      this.successfulActions += 1;
    } catch (err: any) {
      this.failedActions += 1;
      this.logger.warn(`Simulator tick failed: ${err?.message}`);
    } finally {
      this.isExecutingStep = false;
      if (this.isRunning && !this.activeAbort) {
        this.restartTimer();
      }
    }
  }

  private async executeSimulatedStep(): Promise<void> {
    await TenantContextStorage.run(
      {
        actor: {
          id: 'simulated-runner',
          type: 'agent',
          roles: ['AI_ORCHESTRATOR', 'ADMIN', 'TENANT_ADMIN'],
          permissions: ['*']
        }
      },
      async () => {
        const scenarios = this.agentMode
          ? [
              () => this.runAgent('sales-agent'),
              () => this.runAgent('inventory-agent'),
              () => this.runAgent('finance-agent'),
              () => this.runAgent('hris-agent'),
              () => this.runAgent('infra-agent'),
              () => this.runAgent('orchestrator'),
              () => this.runAgent('debugger-agent'),
              () => this.runAgent('tester-agent')
            ]
          : [
              () => this.stepSalesInbound(),
              () => this.stepInventoryCheck(),
              () => this.stepFinanceBudgetApproval(),
              () => this.stepHrisCapacityCheck(),
              () => this.stepInfraTelemetryPulse(),
              () => this.stepAiReasoningGoal()
            ];

        const stepFn = scenarios[this.actionCursor % scenarios.length];
        this.actionCursor += 1;
        await stepFn();
      }
    );
  }

  private buildAgentSpec(agentId: string): {
    displayName: string;
    systemPrompt: string;
    objective: string;
    tools: any[];
    target: string;
  } | null {
    if (!this.toolsFactory) return null;

    const ctx = {
      customerId: this.seededCustomerId,
      warehouseId: this.seededWarehouseId,
      productIds: this.seededProductIds,
      departmentId: this.seededDepartmentId,
      salesRepIds: this.seededSalesRepIds
    };

    const modeHint =
      this.mode === 'FLASH_SALE'
        ? 'The company is running a FLASH SALE: marketplace traffic is surging.'
        : this.mode === 'CHAOS'
          ? 'The system is in CHAOS mode: expect failures and anomalies.'
          : 'Operations are running under normal load.';

    const base = `You are an autonomous AI agent inside a live multi-tenant ERP platform. ${modeHint}
You have real tools that read and WRITE to the production database. Every write is permanent and audited.

Rules:
1. ALWAYS inspect current state with read tools before deciding to write.
2. Only write when the data justifies it. Doing nothing is a valid, often correct, decision.
3. Never invent IDs — use IDs returned by your read tools.
4. When done, reply with ONE sentence stating what you decided and why, citing the real numbers you observed.`;

    switch (agentId) {
      case 'sales-agent':
        return {
          displayName: 'Sales Agent',
          target: 'inventory-agent',
          tools: [...this.toolsFactory.salesTools(ctx), ...this.toolsFactory.inventoryTools(ctx)],
          systemPrompt: `${base}

You own the Sales domain. Two revenue streams exist:
- MARKETPLACE: customer self-checkout, auto-approved, no rep involved.
- DIRECT_SALES: a lead assigned to a sales rep who must close it WON or LOST.

Your job: keep the pipeline healthy. Decide whether to bring in new demand, and whether any open DIRECT_SALES lead should now be closed based on rep KPI performance.`,
          objective: `Review the current sales pipeline and rep performance, then take the single most valuable action. Consider: is there enough demand flowing? Are there stale open leads that should be closed WON or LOST? Check stock before promising large orders.`
        };

      case 'inventory-agent':
        return {
          displayName: 'Inventory Agent',
          target: 'finance-agent',
          tools: [...this.toolsFactory.inventoryTools(ctx), ...this.toolsFactory.salesTools(ctx).filter((t) => t.sideEffect === 'READ')],
          systemPrompt: `${base}

You own Inventory. You protect stock integrity: approved orders must have reserved stock, and you must never over-reserve beyond availability.`,
          objective: `Inspect approved sales orders and current reservations. If approved orders lack stock reservations, reserve the correct quantity. If stock is tight, report it instead of reserving.`
        };

      case 'finance-agent':
        return {
          displayName: 'Finance Agent',
          target: 'hris-agent',
          tools: [
            ...this.toolsFactory.financeTools(),
            ...this.toolsFactory.salesTools(ctx).filter((t) => t.sideEffect === 'READ')
          ],
          systemPrompt: `${base}

You own Financial governance including the AI cognitive budget. You must detect runaway AI spend and escalate to a human before the budget is exhausted.`,
          objective: `Audit AI spend against budget and review revenue from both sales channels. If any agent is burning budget disproportionately or the daily cap is close to exhausted, escalate to a human. Otherwise report the financial position.`
        };

      case 'hris-agent':
        return {
          displayName: 'HRIS Agent',
          target: 'infra-agent',
          tools: [
            ...this.toolsFactory.hrisTools(ctx),
            ...this.toolsFactory.salesTools(ctx).filter((t) => t.sideEffect === 'READ')
          ],
          systemPrompt: `${base}

You own Workforce operations: warehouse pickers/packers and couriers. Capacity rules: 4 orders per warehouse staff, 5 deliveries per courier. When demand exceeds capacity you must act — assign couriers, authorize overtime, and escalate critical overload to humans.`,
          objective: `Determine current fulfillment demand from sales orders, then assess whether your warehouse and courier staff can handle it. Take corrective staffing action if they cannot.`
        };

      case 'infra-agent':
        return {
          displayName: 'Infra Agent',
          target: 'orchestrator',
          tools: [
            ...this.toolsFactory.infraTools(),
            ...this.toolsFactory.salesTools(ctx).filter((t) => t.sideEffect === 'READ')
          ],
          systemPrompt: `${base}

You own Kubernetes infrastructure. You scale capacity to match business load, but scaling costs money and must be justified by real backlog.`,
          objective: `Check cluster state and current order backlog. Decide whether the platform needs more replicas. Only request scaling if the backlog genuinely justifies the cost.`
        };

      case 'debugger-agent':
        return {
          displayName: 'QA & Auditor',
          target: 'orchestrator',
          tools: [
            ...this.toolsFactory.auditorTools(ctx),
            ...this.toolsFactory.salesTools(ctx).filter((t) => t.sideEffect === 'READ'),
            ...this.toolsFactory.inventoryTools(ctx).filter((t) => t.sideEffect === 'READ'),
            ...this.toolsFactory.financeTools().filter((t) => t.sideEffect === 'READ')
          ],
          systemPrompt: `${base}

You own System Consistency & Compliance Audit. You audit immutable audit logs, verify cross-domain business invariants, and raise formal compliance tickets when invariants are violated.`,
          objective: `Audit recent system actions and cross-domain state consistency. Verify that approved sales orders match inventory reservations, deliveries are properly assigned, and audit logs are recorded. Flag any compliance anomalies found.`
        };

      case 'tester-agent':
        return {
          displayName: 'Tester Agent',
          target: 'infra-agent',
          tools: [
            ...this.toolsFactory.testerTools(ctx),
            ...this.toolsFactory.salesTools(ctx).filter((t) => t.sideEffect === 'READ'),
            ...this.toolsFactory.inventoryTools(ctx).filter((t) => t.sideEffect === 'READ')
          ],
          systemPrompt: `${base}

You own Automated Contract Verification and Synthetic Probing. You run health probes against domain service endpoints, verify tenant isolation boundaries, and record synthetic test assertions into the audit system.`,
          objective: `Execute synthetic contract probes across business domains and verify tenant isolation boundaries. Record test assertions and report any degraded services or boundary leaks.`
        };

      case 'orchestrator':
      default:
        return {
          displayName: 'AI Orchestrator',
          target: 'all',
          tools: [
            ...this.toolsFactory.salesTools(ctx).filter((t) => t.sideEffect === 'READ'),
            ...this.toolsFactory.inventoryTools(ctx).filter((t) => t.sideEffect === 'READ'),
            ...this.toolsFactory.hrisTools(ctx).filter((t) => t.sideEffect === 'READ'),
            ...this.toolsFactory.infraTools().filter((t) => t.sideEffect === 'READ'),
            ...this.toolsFactory.financeTools()
          ],
          systemPrompt: `${base}

You are the macro Orchestrator. You do not run day-to-day operations; you detect cross-module inconsistencies and systemic risk that individual agents cannot see alone, and escalate to humans when needed.`,
          objective: `Inspect state across sales, inventory, workforce, infrastructure and budget. Identify the single biggest cross-module risk or inconsistency right now. Escalate to a human only if it genuinely requires human judgment.`
        };
    }
  }

  private async runAgent(agentId: string): Promise<void> {
    if (!this.isRunning || this.activeAbort) return;

    await this.ensureBusinessSeedData();
    await this.ensureSalesRepSeedData();
    await this.ensureWorkforceSeedData();

    if (!this.isRunning || this.activeAbort) return;

    const spec = this.buildAgentSpec(agentId);

    if (!this.agentRuntime || !spec) {
      this.emitOfficeEvent({
        action: 'AGENT_RUNTIME_UNAVAILABLE',
        actor: agentId,
        target: 'all',
        speechBubble: '[NO RUNTIME] Agent runtime or tools unavailable.',
        mood: 'warning',
        data: { module: 'agent-runtime', persisted: false }
      });
      return;
    }

    this.emitOfficeEvent({
      action: 'AGENT_THINKING',
      actor: agentId,
      target: spec.target,
      speechBubble: `Analyzing: ${spec.objective.slice(0, 90)}...`,
      mood: 'thinking',
      data: { module: 'agent-runtime', toolsAvailable: spec.tools.length, persisted: false }
    });

    const result = await this.agentRuntime.run({
      agentName: agentId,
      systemPrompt: spec.systemPrompt,
      objective: spec.objective,
      tools: spec.tools,
      maxIterations: 5,
      maxCostUsd: 0.02,
      isAborted: () => !this.isRunning || this.activeAbort,
      onToolInvoked: (record) => {
        if (!this.isRunning || this.activeAbort) return;

        this.emitOfficeEvent({
          action: record.sideEffect === 'READ' ? 'AGENT_TOOL_READ' : 'AGENT_TOOL_WRITE',
          actor: agentId,
          target: spec.target,
          speechBubble: `${record.sideEffect === 'READ' ? 'Reading' : 'Writing'}: ${record.toolName}(${Object.keys(record.arguments).join(', ')})`,
          mood: record.ok ? (record.sideEffect === 'READ' ? 'thinking' : 'working') : 'warning',
          data: {
            module: 'agent-runtime',
            toolName: record.toolName,
            sideEffect: record.sideEffect,
            arguments: record.arguments,
            result: record.result,
            ok: record.ok,
            error: record.error,
            durationMs: record.durationMs,
            step: record.step,
            persisted: record.ok && record.sideEffect !== 'READ'
          }
        });
      }
    });

    if (!this.isRunning || this.activeAbort || result.stopReason === 'CANCELLED') {
      return;
    }

    this.lastAction = `AGENT_${agentId.toUpperCase().replace(/-/g, '_')}`;
    this.lastActor = agentId;
    this.lastSpeechBubble = result.finalAnswer;
    this.lastTimestamp = new Date().toISOString();

    const writeTools = result.toolCalls.filter((t) => t.sideEffect !== 'READ' && t.ok);

    this.emitOfficeEvent({
      action: 'AGENT_RUN_COMPLETED',
      actor: agentId,
      target: spec.target,
      speechBubble: result.finalAnswer,
      mood: result.stopReason === 'COMPLETED' ? (writeTools.length > 0 ? 'happy' : 'neutral') : 'warning',
      data: {
        module: 'agent-runtime',
        agentDisplayName: spec.displayName,
        iterations: result.iterations,
        stopReason: result.stopReason,
        toolCallCount: result.toolCalls.length,
        toolsUsed: result.toolCalls.map((t) => t.toolName),
        writesPerformed: result.writesPerformed,
        tokens: result.totalInputTokens + result.totalOutputTokens,
        estimatedCostUsd: result.totalCostUsd,
        persisted: writeTools.length > 0
      }
    });
  }

  private async narrateOutcome(
    agentRole: string,
    outcome: { operation: string; facts: Record<string, unknown> }
  ): Promise<string> {
    const factLines = Object.entries(outcome.facts)
      .map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
      .join('\n');

    const deterministicSummary = `${outcome.operation} | ${Object.entries(outcome.facts)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(', ')}`;

    // Narration is cosmetic: it only rewrites an already-completed operation as
    // a sentence. When it is disabled, or the provider is unavailable, business
    // steps must still run on the deterministic summary rather than stalling.
    if (!this.omniRouter || !this.autoAiReasoning) {
      return deterministicSummary;
    }

    try {
      const model = process.env.AI_MODEL_REASONING || 'Infrastructure';
      const prompt = [
        `You are the ${agentRole} in an autonomous ERP platform.`,
        `An operation just COMPLETED in the system. Here is the factual result:`,
        ``,
        `Operation: ${outcome.operation}`,
        factLines,
        ``,
        `Write exactly ONE short sentence (max 20 words) explaining what you did and why,`,
        `citing the concrete numbers/IDs above. Do not invent facts not listed. No preamble.`
      ].join('\n');

      const res = await this.omniRouter.complete({
        model,
        prompt,
        maxTokens: 60,
        temperature: 0.3
      });

      const reasoning = res.content.replace(/\n+/g, ' ').trim().slice(0, 180);
      this.logger.log(`[AI Narration: ${model} | ${agentRole}] ${outcome.operation} -> "${reasoning}"`);

      if (this.aiBudget) {
        await this.aiBudget.recordUsage({
          agentName: agentRole.toLowerCase().replace(/\s+/g, '-'),
          model,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          estimatedCostUsd: res.estimatedCostUsd,
          latencyMs: res.latencyMs
        }).catch(() => null);
      }

      return reasoning || deterministicSummary;
    } catch (err: any) {
      this.logger.warn(`AI narration failed for [${agentRole}]: ${err?.message}`);
      // A rate limit on narration is deliberately NOT reported to the rate-limit
      // supervisor. Doing so paused the entire simulator — including database
      // work that needs no LLM at all — so a throttled free-tier model brought
      // all business activity to a halt. Only agent reasoning, which genuinely
      // cannot proceed without the provider, should trigger a global pause.
      return `[LLM UNAVAILABLE] ${deterministicSummary}`;
    }
  }

  private async callLlmReasoning(agentRole: string, taskDescription: string): Promise<string> {
    if (!this.omniRouter) {
      return `Autonomous decision completed by ${agentRole}.`;
    }

    try {
      const model = process.env.AI_MODEL_REASONING || 'Infrastructure';
      const prompt = `You are the ${agentRole} in an autonomous enterprise platform. Provide a concise, professional 1-sentence reasoning/action on: "${taskDescription}". Output only 1 short sentence.`;
      const res = await this.omniRouter.complete({
        model,
        prompt,
        maxTokens: 60,
        temperature: 0.3
      });

      const reasoning = res.content.replace(/\n+/g, ' ').trim().slice(0, 150);
      this.logger.log(`[AI Inference: ${model} | ${agentRole}] -> "${reasoning}"`);

      // Record tokens in live FinOps budget ledger
      if (this.aiBudget) {
        await this.aiBudget.recordUsage({
          agentName: agentRole.toLowerCase().replace(/\s+/g, '-'),
          model,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          estimatedCostUsd: res.estimatedCostUsd,
          latencyMs: res.latencyMs
        }).catch(() => null);
      }

      return reasoning;
    } catch (err: any) {
      this.logger.warn(`AI Provider call failed for [${agentRole}]: ${err?.message}`);
      if (err?.status === 429 || String(err?.message).includes('429')) {
        this.rateLimitSupervisor?.recordRateLimit('Infrastructure', 30);
      }
      return `${agentRole} policy evaluated: task authorized within deterministic bounds.`;
    }
  }

  private async stepSalesInbound(): Promise<void> {
    await this.ensureBusinessSeedData();
    await this.ensureSalesRepSeedData();

    const marketplaceBias = this.mode === 'FLASH_SALE' ? 0.75 : 0.5;
    const isMarketplace = Math.random() < marketplaceBias;
    const quantity = Math.floor(1 + Math.random() * 5);

    let orderNumber = 'n/a';
    let amount = 0;
    let persisted = false;
    let orderId: string | undefined;
    let assignedRepName = 'none';
    let closedOutcome = 'n/a';

    if (this.salesService && this.seededCustomerId && this.seededProductIds.length > 0) {
      const productId = this.seededProductIds[Math.floor(Math.random() * this.seededProductIds.length)];
      const unitPrice = Number((25 + Math.random() * 125).toFixed(2));
      const repId = this.seededSalesRepIds.length > 0
        ? this.seededSalesRepIds[Math.floor(Math.random() * this.seededSalesRepIds.length)]
        : undefined;

      try {
        const created = await this.salesService.createSalesOrder({
          customerId: this.seededCustomerId,
          items: [{ productId, quantity, unitPrice }],
          notes: isMarketplace ? 'Marketplace self-service checkout' : 'Direct sales lead',
          channel: isMarketplace ? SalesChannel.MARKETPLACE : SalesChannel.DIRECT_SALES,
          assignedRepId: isMarketplace ? undefined : repId
        });

        if (created.data) {
          orderNumber = created.data.orderNumber;
          amount = created.data.totalAmount;
          orderId = created.data.id;
          persisted = true;

          if (!isMarketplace && repId) {
            const reps = await this.salesService.listSalesReps();
            assignedRepName = (reps.data ?? []).find((r) => r.id === repId)?.fullName ?? repId;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Sales order persistence failed: ${err?.message}`);
      }
    }

    if (!isMarketplace && orderId && this.salesService) {
      const won = Math.random() < 0.6;
      try {
        await this.salesService.closeLead(orderId, {
          outcome: won ? 'WON' : 'LOST',
          lostReason: won ? undefined : 'Customer chose competitor pricing'
        });
        closedOutcome = won ? 'WON' : 'LOST';
      } catch (err: any) {
        this.logger.warn(`Lead closing failed: ${err?.message}`);
      }
    }

    const reasoning = await this.narrateOutcome('Sales Agent', {
      operation: isMarketplace
        ? 'Marketplace order auto-approved (self-service checkout)'
        : `Direct sales lead handled by rep and closed as ${closedOutcome}`,
      facts: {
        channel: isMarketplace ? 'MARKETPLACE' : 'DIRECT_SALES',
        orderNumber,
        totalAmount: `$${Number(amount).toFixed(2)}`,
        quantity,
        assignedRep: assignedRepName,
        leadOutcome: closedOutcome,
        persistedToDatabase: persisted
      }
    });

    this.lastAction = isMarketplace ? 'MARKETPLACE_ORDER_RECEIVED' : 'DIRECT_SALES_LEAD_CLOSED';
    this.lastActor = 'sales-agent';
    this.lastSpeechBubble = reasoning;
    this.lastTimestamp = new Date().toISOString();

    this.emitOfficeEvent({
      action: isMarketplace ? 'MARKETPLACE_ORDER_RECEIVED' : 'DIRECT_SALES_LEAD_CLOSED',
      actor: 'sales-agent',
      target: 'inventory-agent',
      speechBubble: this.lastSpeechBubble,
      mood: closedOutcome === 'LOST' ? 'warning' : 'working',
      data: {
        channel: isMarketplace ? 'MARKETPLACE' : 'DIRECT_SALES',
        orderNumber,
        amount,
        quantity,
        orderId,
        assignedRep: assignedRepName,
        leadOutcome: closedOutcome,
        persisted,
        module: 'sales'
      }
    });
  }

  private async stepInventoryCheck(): Promise<void> {
    await this.ensureBusinessSeedData();

    const qty = Math.floor(1 + Math.random() * 10);
    let sku = 'SKU-PREMIUM-A';
    let persisted = false;
    let reservationId: string | undefined;
    let availableQty: number | undefined;

    if (this.inventoryService && this.seededWarehouseId && this.seededProductIds.length > 0) {
      const productId = this.seededProductIds[Math.floor(Math.random() * this.seededProductIds.length)];

      try {
        const product = await this.inventoryService.getProduct(productId);
        sku = product.data?.sku ?? sku;

        const reserved = await this.inventoryService.reserveStock({
          warehouseId: this.seededWarehouseId,
          productId,
          quantity: qty
        });

        if (reserved.data) {
          reservationId = reserved.data.id;
          persisted = true;
        }

        const availability = await this.inventoryService
          .checkAvailability(this.seededWarehouseId, productId, qty)
          .catch(() => null);
        availableQty = (availability as any)?.data?.availableQuantity;
      } catch (err: any) {
        this.logger.warn(`Inventory reservation failed: ${err?.message}`);
      }
    }

    const reasoning = await this.narrateOutcome('Inventory Agent', {
      operation: persisted ? 'Stock reserved in warehouse ledger' : 'Stock reservation failed',
      facts: {
        sku,
        quantityReserved: qty,
        remainingAvailable: availableQty ?? 'unknown',
        reservationId: reservationId ?? 'none',
        persistedToDatabase: persisted
      }
    });

    this.lastAction = 'INVENTORY_STOCK_RESERVATION';
    this.lastActor = 'inventory-agent';
    this.lastSpeechBubble = reasoning;
    this.lastTimestamp = new Date().toISOString();

    this.emitOfficeEvent({
      action: 'INVENTORY_RESERVED',
      actor: 'inventory-agent',
      target: 'finance-agent',
      speechBubble: this.lastSpeechBubble,
      mood: 'working',
      data: { sku, quantity: qty, reservationId, availableQty, persisted, module: 'inventory' }
    });
  }

  private async stepFinanceBudgetApproval(): Promise<void> {
    const budgetStatus = await this.aiBudget?.getStatus().catch(() => null);

    if (!budgetStatus) {
      this.emitOfficeEvent({
        action: 'FINANCE_AUDIT_UNAVAILABLE',
        actor: 'finance-agent',
        target: 'hris-agent',
        speechBubble: '[NO DATA] Budget service unreachable — audit skipped.',
        mood: 'warning',
        data: { module: 'ai-budget', persisted: false }
      });
      return;
    }

    const dailyRemaining = budgetStatus.dailyRemainingUsd;
    const dailyUsed = budgetStatus.dailyUsedUsd;
    const agentUsage = await this.aiBudget?.getAgentUsageBreakdown().catch(() => []);
    const totalCalls = (agentUsage ?? []).reduce((sum, a) => sum + a.calls, 0);
    const topSpender = (agentUsage ?? [])[0];

    const reasoning = await this.narrateOutcome('Finance Agent', {
      operation: 'Cognitive budget ledger audited',
      facts: {
        dailySpentUsd: `$${dailyUsed.toFixed(4)}`,
        dailyRemainingUsd: `$${dailyRemaining.toFixed(4)}`,
        totalLlmCallsToday: totalCalls,
        topSpendingAgent: topSpender ? `${topSpender.agentName} ($${topSpender.dailySpent.toFixed(4)})` : 'none',
        budgetExceeded: budgetStatus.isDailyExceeded
      }
    });

    this.lastAction = 'FINANCE_BUDGET_AUDIT';
    this.lastActor = 'finance-agent';
    this.lastSpeechBubble = reasoning;
    this.lastTimestamp = new Date().toISOString();

    this.emitOfficeEvent({
      action: 'FINANCE_AUDITED',
      actor: 'finance-agent',
      target: 'hris-agent',
      speechBubble: this.lastSpeechBubble,
      mood: budgetStatus.isDailyExceeded ? 'warning' : 'happy',
      data: {
        remainingUsd: dailyRemaining,
        spentUsd: dailyUsed,
        totalCalls,
        module: 'ai-budget',
        persisted: true
      }
    });
  }

  private async stepHrisCapacityCheck(): Promise<void> {
    await this.ensureWorkforceSeedData();

    if (!this.hrisService || !this.seededDepartmentId) {
      this.emitOfficeEvent({
        action: 'HRIS_CAPACITY_UNAVAILABLE',
        actor: 'hris-agent',
        target: 'infra-agent',
        speechBubble: '[NO DATA] HRIS service unreachable — staffing assessment skipped.',
        mood: 'warning',
        data: { module: 'hris', persisted: false }
      });
      return;
    }

    const orders = await this.salesService
      ?.listSalesOrders()
      .then((r) => r.data ?? [])
      .catch(() => []);

    const pendingOrders = (orders ?? []).filter(
      (o: any) => o.status === 'DRAFT' || o.status === 'PENDING_APPROVAL'
    ).length;

    const ordersReadyToShip = (orders ?? [])
      .filter((o: any) => o.status === 'APPROVED')
      .map((o: any) => ({ orderId: o.id, orderNumber: o.orderNumber }));

    let assessment: any = null;
    try {
      const res = await this.hrisService.assessStaffing({
        departmentId: this.seededDepartmentId,
        pendingOrders,
        ordersReadyToShip
      });
      assessment = res.data;
    } catch (err: any) {
      this.logger.warn(`Staffing assessment failed: ${err?.message}`);
    }

    if (!assessment) {
      this.emitOfficeEvent({
        action: 'HRIS_ASSESSMENT_FAILED',
        actor: 'hris-agent',
        target: 'infra-agent',
        speechBubble: '[FAILED] Staffing assessment could not be completed.',
        mood: 'warning',
        data: { module: 'hris', persisted: false }
      });
      return;
    }

    const reasoning = await this.narrateOutcome('HRIS Agent', {
      operation: `Staffing assessed — severity ${assessment.severity}`,
      facts: {
        pendingOrders: assessment.pendingOrders,
        warehouseStaff: `${assessment.warehouseStaff} (capacity ${assessment.warehouseCapacity})`,
        courierStaff: `${assessment.courierStaff} (capacity ${assessment.courierCapacity})`,
        warehouseUtilization: `${(assessment.warehouseUtilization * 100).toFixed(0)}%`,
        courierUtilization: `${(assessment.courierUtilization * 100).toFixed(0)}%`,
        deliveriesAssigned: assessment.deliveryIds.length,
        overtimeRequests: assessment.overtimeRequestIds.length,
        escalationTicket: assessment.escalationTicketId ?? 'none',
        actions: assessment.actionsTaken.join('; ')
      }
    });

    const eventAction =
      assessment.severity === 'CRITICAL'
        ? 'HRIS_CRITICAL_ESCALATION'
        : assessment.overtimeRequestIds.length > 0
          ? 'HRIS_OVERTIME_REQUESTED'
          : assessment.deliveryIds.length > 0
            ? 'HRIS_COURIER_ASSIGNED'
            : 'HRIS_CAPACITY_OK';

    this.lastAction = eventAction;
    this.lastActor = 'hris-agent';
    this.lastSpeechBubble = reasoning;
    this.lastTimestamp = new Date().toISOString();

    this.emitOfficeEvent({
      action: eventAction,
      actor: 'hris-agent',
      target: 'infra-agent',
      speechBubble: this.lastSpeechBubble,
      mood:
        assessment.severity === 'CRITICAL' || assessment.severity === 'OVERLOADED'
          ? 'warning'
          : assessment.deliveryIds.length > 0
            ? 'working'
            : 'neutral',
      data: {
        severity: assessment.severity,
        pendingOrders: assessment.pendingOrders,
        warehouseStaff: assessment.warehouseStaff,
        courierStaff: assessment.courierStaff,
        warehouseUtilization: assessment.warehouseUtilization,
        courierUtilization: assessment.courierUtilization,
        deliveriesAssigned: assessment.deliveryIds.length,
        overtimeRequests: assessment.overtimeRequestIds.length,
        escalationTicketId: assessment.escalationTicketId,
        hiringRecommendation: assessment.hiringRecommendation,
        actionsTaken: assessment.actionsTaken,
        module: 'hris',
        persisted:
          assessment.deliveryIds.length > 0 ||
          assessment.overtimeRequestIds.length > 0 ||
          Boolean(assessment.escalationTicketId)
      }
    });
  }

  private async stepInfraTelemetryPulse(): Promise<void> {
    if (!this.infraService) {
      this.emitOfficeEvent({
        action: 'INFRA_TELEMETRY_UNAVAILABLE',
        actor: 'infra-agent',
        target: 'orchestrator',
        speechBubble: '[NO DATA] Infrastructure service unreachable — telemetry skipped.',
        mood: 'warning',
        data: { module: 'infrastructure', persisted: false }
      });
      return;
    }

    const namespace = process.env.K8S_NAMESPACE || 'default';
    const snapshot = await this.infraService
      .getClusterSnapshot(namespace)
      .then((r) => r.data)
      .catch(() => null);

    if (!snapshot) {
      this.emitOfficeEvent({
        action: 'INFRA_TELEMETRY_UNAVAILABLE',
        actor: 'infra-agent',
        target: 'orchestrator',
        speechBubble: `[NO DATA] Cluster snapshot failed for namespace "${namespace}".`,
        mood: 'warning',
        data: { module: 'infrastructure', namespace, persisted: false }
      });
      return;
    }

    const podCount = snapshot.pods?.length ?? 0;
    const nodeCount = snapshot.nodes?.length ?? 0;
    const deployments = snapshot.deployments ?? [];
    const readyPods = snapshot.pods?.filter((p: any) => p.status === 'Running' || p.ready).length ?? 0;

    const allOrders = await this.salesService
      ?.listSalesOrders()
      .then((r) => r.data ?? [])
      .catch(() => []);

    // Capacity is driven by the arrival *rate*, not just the size of the
    // backlog: a shopping event is characterised by how fast orders come in.
    const ordersPerMinute = ordersPerMinuteFrom(allOrders ?? []);
    const pendingOrders = (allOrders ?? []).filter(
      (o: any) => o.status === 'DRAFT' || o.status === 'PENDING_APPROVAL' || o.status === 'APPROVED'
    ).length;

    const targetDeployment = deployments[0];
    const currentReplicas = (targetDeployment as any)?.replicas ?? readyPods;

    const decision = planCapacity({
      currentReplicas,
      ordersPerMinute,
      pendingOrders,
      mode: this.mode
    });

    const shouldScale = decision.kind !== 'HOLD' && Boolean(targetDeployment);

    let scalingEventId: string | undefined;
    let persisted = false;
    let rejectionReason: string | undefined;

    if (shouldScale) {
      try {
        const created = await this.infraService.requestScaling({
          namespace,
          deploymentName: (targetDeployment as any).name,
          toReplicas: decision.targetReplicas,
          reason: decision.reason,
          projectedCostUsd: decision.projectedCostUsd
        });
        scalingEventId = created.data?.id;
        persisted = Boolean(scalingEventId);

        // requestScaling reports policy and budget refusals as an event status
        // rather than by throwing, so the outcome has to be inspected.
        const status = (created.data as any)?.status;
        if (status && status !== 'EXECUTED' && status !== 'PENDING') {
          rejectionReason = status;
        }
      } catch (err: any) {
        rejectionReason = err?.message;
        this.logger.warn(`Scaling request failed: ${err?.message}`);
      }
    }

    const reasoning = await this.narrateOutcome('Infra Agent', {
      operation: shouldScale
        ? persisted && !rejectionReason
          ? `Kubernetes ${decision.kind === 'SCALE_UP' ? 'scale-up' : 'scale-down'} executed`
          : `Scaling needed but not applied (${rejectionReason ?? 'request rejected'})`
        : 'Cluster telemetry captured, capacity already matches demand',
      facts: {
        namespace,
        nodes: nodeCount,
        pods: podCount,
        readyPods,
        deployments: deployments.length,
        ordersPerMinute,
        orderBacklog: pendingOrders,
        loadPerReplica: decision.ordersPerReplica,
        trafficMode: this.mode,
        decision: decision.kind,
        replicaChange: shouldScale
          ? `${currentReplicas} -> ${decision.targetReplicas}`
          : `${currentReplicas} (unchanged)`,
        projectedHourlyCostUsd: `$${decision.projectedCostUsd.toFixed(4)}`,
        scalingEventId: scalingEventId ?? 'none'
      }
    });

    this.lastAction = 'INFRA_SCALE_CHECK';
    this.lastActor = 'infra-agent';
    this.lastSpeechBubble = reasoning;
    this.lastTimestamp = new Date().toISOString();

    this.emitOfficeEvent({
      action: shouldScale
        ? decision.kind === 'SCALE_UP'
          ? 'INFRA_SCALE_UP_REQUESTED'
          : 'INFRA_SCALE_DOWN_REQUESTED'
        : 'INFRA_TELEMETRY',
      actor: 'infra-agent',
      target: 'orchestrator',
      speechBubble: this.lastSpeechBubble,
      mood: decision.kind === 'SCALE_UP' ? 'warning' : 'working',
      data: {
        namespace,
        podCount,
        nodeCount,
        readyPods,
        ordersPerMinute,
        orderBacklog: pendingOrders,
        decision: decision.kind,
        currentReplicas,
        targetReplicas: decision.targetReplicas,
        replicaDelta: decision.replicaDelta,
        projectedHourlyCostUsd: decision.projectedCostUsd,
        replicaHourlyCostUsd: REPLICA_HOURLY_COST_USD,
        trafficMode: this.mode,
        scalingEventId,
        rejectionReason,
        module: 'infrastructure',
        persisted
      }
    });
  }

  private async stepAiReasoningGoal(): Promise<void> {
    if (!this.orchestrator) {
      this.emitOfficeEvent({
        action: 'ORCHESTRATOR_UNAVAILABLE',
        actor: 'orchestrator',
        target: 'all',
        speechBubble: '[NO DATA] Orchestrator service unreachable — goal execution skipped.',
        mood: 'warning',
        data: { module: 'orchestrator', persisted: false }
      });
      return;
    }

    const pendingOrders = await this.salesService
      ?.listSalesOrders()
      .then((r) => (r.data ?? []).filter((o: any) => o.status === 'DRAFT').length)
      .catch(() => 0);

    const backlogHigh = (pendingOrders ?? 0) > 5;
    const goalSpec = backlogHigh
      ? {
          goal: `Resolve order backlog of ${pendingOrders} pending orders across fulfillment pipeline`,
          complexity: 'CRITICAL_DECISION' as const,
          riskLevel: 'HIGH' as const
        }
      : {
          goal: `Verify cross-module consistency for ${pendingOrders} active orders`,
          complexity: 'SIMPLE_QUERY' as const,
          riskLevel: 'LOW' as const
        };

    let result: any = null;
    let persisted = false;

    try {
      result = await this.orchestrator.executeGoal({
        goal: goalSpec.goal,
        agentName: 'orchestrator',
        complexity: goalSpec.complexity,
        riskLevel: goalSpec.riskLevel,
        trustRequirement: 0.7
      });
      persisted = Boolean(result?.workflowId);
    } catch (err: any) {
      this.logger.warn(`Orchestrator goal execution failed: ${err?.message}`);
    }

    if (!result) {
      this.emitOfficeEvent({
        action: 'ORCHESTRATOR_GOAL_FAILED',
        actor: 'orchestrator',
        target: 'all',
        speechBubble: `[FAILED] Goal execution rejected: "${goalSpec.goal}"`,
        mood: 'warning',
        data: { module: 'orchestrator', goal: goalSpec.goal, persisted: false }
      });
      return;
    }

    const reasoning = await this.narrateOutcome('AI Orchestrator', {
      operation: 'Autonomous goal routed and executed through governance pipeline',
      facts: {
        goal: goalSpec.goal,
        modelTier: result.routing?.tier ?? 'unknown',
        selectedModel: result.routing?.model ?? 'unknown',
        outcome: result.outcome,
        confidence: typeof result.confidence === 'number' ? result.confidence.toFixed(2) : 'n/a',
        requiresHumanApproval: result.routing?.requiresHumanApproval ?? false,
        workflowId: result.workflowId
      }
    });

    this.lastAction = 'AI_LIVE_REASONING';
    this.lastActor = 'orchestrator';
    this.lastSpeechBubble = reasoning;
    this.lastTimestamp = new Date().toISOString();

    this.emitOfficeEvent({
      action: 'AI_REASONING_COMPLETED',
      actor: 'orchestrator',
      target: 'all',
      speechBubble: this.lastSpeechBubble,
      mood: result.outcome === 'ESCALATE' ? 'warning' : 'thinking',
      data: {
        workflowId: result.workflowId,
        tier: result.routing?.tier,
        model: result.routing?.model,
        outcome: result.outcome,
        confidence: result.confidence,
        module: 'orchestrator',
        persisted
      }
    });
  }

  private emitOfficeEvent(payload: {
    action: string;
    actor: string;
    target: string;
    speechBubble: string;
    mood: 'neutral' | 'working' | 'happy' | 'warning' | 'thinking';
    data?: Record<string, unknown>;
  }): void {
    if (this.eventStream) {
      this.eventStream.emit({
        action: payload.action,
        tenantId: this.currentTenantId,
        actor: { id: payload.actor, type: 'agent' },
        timestamp: new Date().toISOString(),
        metadata: {
          actorName: payload.actor,
          targetAgent: payload.target,
          speechBubble: payload.speechBubble,
          mood: payload.mood,
          desk: AGENT_PERSONAS[payload.actor]?.desk ?? 'Office Floor',
          persona: AGENT_PERSONAS[payload.actor],
          ...payload.data
        }
      });
    }

    if (this.auditService) {
      this.auditService.record({
        action: payload.action,
        input: { actor: payload.actor, target: payload.target },
        output: { speechBubble: payload.speechBubble },
        status: 'SUCCESS'
      });
    }
  }

  onModuleDestroy(): void {
    this.stop();
  }
}
