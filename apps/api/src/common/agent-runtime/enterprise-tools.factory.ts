import { Inject, Injectable, Optional } from '@nestjs/common';
import { SalesChannel, DeliveryStatus } from '@autonomous-enterprise/contracts';
import { SalesService } from '../../modules/sales/sales.service';
import { InventoryService } from '../../modules/inventory/inventory.service';
import { HrisService } from '../../modules/hris/hris.service';
import { InfrastructureService } from '../../modules/infrastructure/infrastructure.service';
import { AiBudgetService } from '../../modules/ai-budget/ai-budget.service';
import { TicketingService } from '../../modules/ticketing/ticketing.service';
import { AuditService } from '../audit/audit.service';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import type { AgentTool } from './agent-tool.types';

export interface EnterpriseToolContext {
  customerId?: string | null;
  warehouseId?: string | null;
  productIds?: string[];
  departmentId?: string | null;
  salesRepIds?: string[];
}

@Injectable()
export class EnterpriseToolsFactory {
  constructor(
    @Optional() @Inject(SalesService) private readonly sales?: SalesService,
    @Optional() @Inject(InventoryService) private readonly inventory?: InventoryService,
    @Optional() @Inject(HrisService) private readonly hris?: HrisService,
    @Optional() @Inject(InfrastructureService) private readonly infra?: InfrastructureService,
    @Optional() @Inject(AiBudgetService) private readonly budget?: AiBudgetService,
    @Optional() @Inject(TicketingService) private readonly ticketing?: TicketingService,
    @Optional() @Inject(AuditService) private readonly auditService?: AuditService
  ) {}

  private obj(properties: Record<string, unknown>, required: string[] = []) {
    return { type: 'object' as const, properties, required };
  }

  salesTools(ctx: EnterpriseToolContext): AgentTool[] {
    if (!this.sales) return [];

    return [
      {
        name: 'list_sales_orders',
        description: 'List all sales orders with status, channel, amount, and assigned rep.',
        sideEffect: 'READ',
        parameters: this.obj({
          status: { type: 'string', description: 'Optional filter: DRAFT, APPROVED, CANCELLED, FULFILLED' }
        }),
        execute: async (args) => {
          const res = await this.sales!.listSalesOrders();
          let orders = res.data ?? [];
          if (args.status) {
            orders = orders.filter((o) => o.status === String(args.status).toUpperCase());
          }
          return {
            count: orders.length,
            orders: orders.slice(-15).map((o) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              channel: o.channel,
              status: o.status,
              totalAmount: o.totalAmount,
              assignedRepId: o.assignedRepId,
              leadOutcome: o.leadOutcome
            }))
          };
        }
      },
      {
        name: 'get_channel_summary',
        description: 'Get revenue and closing-rate breakdown for MARKETPLACE vs DIRECT_SALES channels.',
        sideEffect: 'READ',
        parameters: this.obj({}),
        execute: async () => (await this.sales!.getChannelSummary()).data
      },
      {
        name: 'get_sales_rep_kpis',
        description: 'Get KPI leaderboard for all sales reps: closing rate, revenue, quota attainment, score, rating.',
        sideEffect: 'READ',
        parameters: this.obj({}),
        execute: async () => (await this.sales!.getSalesRepKpis()).data
      },
      {
        name: 'create_sales_order',
        description:
          'Create a real sales order in the database. Use channel MARKETPLACE for self-service checkout (auto-approved), or DIRECT_SALES for a lead that a rep must close.',
        sideEffect: 'WRITE',
        parameters: this.obj(
          {
            channel: { type: 'string', enum: ['MARKETPLACE', 'DIRECT_SALES'], description: 'Sales channel' },
            quantity: { type: 'number', description: 'Units ordered (1-10)' },
            unitPrice: { type: 'number', description: 'Price per unit in USD' },
            assignedRepId: { type: 'string', description: 'Sales rep ID, required only for DIRECT_SALES' }
          },
          ['channel', 'quantity', 'unitPrice']
        ),
        execute: async (args) => {
          if (!ctx.customerId || !ctx.productIds?.length) {
            return { error: 'No seeded customer or product available' };
          }
          const channel =
            String(args.channel).toUpperCase() === 'MARKETPLACE'
              ? SalesChannel.MARKETPLACE
              : SalesChannel.DIRECT_SALES;
          const productId = ctx.productIds[Math.floor(Math.random() * ctx.productIds.length)];

          const res = await this.sales!.createSalesOrder({
            customerId: ctx.customerId,
            items: [
              {
                productId,
                quantity: Math.max(1, Math.min(10, Number(args.quantity) || 1)),
                unitPrice: Math.max(1, Number(args.unitPrice) || 50)
              }
            ],
            channel,
            assignedRepId:
              channel === SalesChannel.DIRECT_SALES
                ? (args.assignedRepId as string) || ctx.salesRepIds?.[0]
                : undefined,
            notes: 'Created autonomously by AI agent'
          });

          return {
            created: true,
            orderId: res.data?.id,
            orderNumber: res.data?.orderNumber,
            status: res.data?.status,
            channel: res.data?.channel,
            totalAmount: res.data?.totalAmount
          };
        }
      },
      {
        name: 'close_sales_lead',
        description:
          'Close a DIRECT_SALES lead as WON or LOST. WON approves the order and credits the rep KPI; LOST cancels it.',
        sideEffect: 'WRITE',
        parameters: this.obj(
          {
            orderId: { type: 'string', description: 'Sales order ID of the lead' },
            outcome: { type: 'string', enum: ['WON', 'LOST'] },
            lostReason: { type: 'string', description: 'Required if outcome is LOST' }
          },
          ['orderId', 'outcome']
        ),
        execute: async (args) => {
          const res = await this.sales!.closeLead(String(args.orderId), {
            outcome: String(args.outcome).toUpperCase() === 'WON' ? 'WON' : 'LOST',
            lostReason: args.lostReason as string | undefined
          });
          return {
            closed: true,
            orderNumber: res.data?.orderNumber,
            leadOutcome: res.data?.leadOutcome,
            status: res.data?.status,
            totalAmount: res.data?.totalAmount
          };
        }
      }
    ];
  }

  inventoryTools(ctx: EnterpriseToolContext): AgentTool[] {
    if (!this.inventory) return [];

    return [
      {
        name: 'check_stock_availability',
        description: 'Check available stock quantity for a product in the warehouse.',
        sideEffect: 'READ',
        parameters: this.obj({ productId: { type: 'string' }, quantity: { type: 'number' } }, ['quantity']),
        execute: async (args) => {
          if (!ctx.warehouseId) return { error: 'No warehouse configured' };
          const productId = (args.productId as string) || ctx.productIds?.[0];
          if (!productId) return { error: 'No product available' };
          const res = await this.inventory!.checkAvailability(
            ctx.warehouseId,
            productId,
            Number(args.quantity) || 1
          );
          return res.data ?? res;
        }
      },
      {
        name: 'list_products',
        description: 'List product catalog with SKU, name, and price.',
        sideEffect: 'READ',
        parameters: this.obj({}),
        execute: async () => {
          const res = await this.inventory!.listProducts();
          return (res.data ?? []).map((p) => ({ id: p.id, sku: p.sku, name: p.name, price: p.price }));
        }
      },
      {
        name: 'reserve_stock',
        description: 'Reserve stock units in the warehouse for an order. Writes a real reservation and ledger entry.',
        sideEffect: 'WRITE',
        parameters: this.obj(
          { productId: { type: 'string' }, quantity: { type: 'number', description: 'Units to reserve' } },
          ['quantity']
        ),
        execute: async (args) => {
          if (!ctx.warehouseId) return { error: 'No warehouse configured' };
          const productId = (args.productId as string) || ctx.productIds?.[0];
          if (!productId) return { error: 'No product available' };
          const res = await this.inventory!.reserveStock({
            warehouseId: ctx.warehouseId,
            productId,
            quantity: Math.max(1, Number(args.quantity) || 1)
          });
          return {
            reserved: true,
            reservationId: res.data?.id,
            quantity: res.data?.quantity,
            status: res.data?.status
          };
        }
      },
      {
        name: 'list_stock_reservations',
        description: 'List current stock reservations.',
        sideEffect: 'READ',
        parameters: this.obj({}),
        execute: async () => {
          const res = await this.inventory!.listReservations();
          return { count: (res.data ?? []).length, recent: (res.data ?? []).slice(-10) };
        }
      }
    ];
  }

  hrisTools(ctx: EnterpriseToolContext): AgentTool[] {
    if (!this.hris) return [];

    return [
      {
        name: 'get_workforce_status',
        description:
          'Get current workforce: employee list with positions (warehouse pickers, packers, couriers) and department workload summary.',
        sideEffect: 'READ',
        parameters: this.obj({}),
        execute: async () => {
          const employees = await this.hris!.listEmployees(ctx.departmentId ?? undefined);
          const workload = ctx.departmentId
            ? await this.hris!.getWorkloadSummary(ctx.departmentId).then((r) => r.data).catch(() => null)
            : null;
          return {
            employees: (employees.data ?? []).map((e) => ({
              id: e.id,
              name: e.fullName,
              position: e.position,
              status: e.status
            })),
            workload
          };
        }
      },
      {
        name: 'list_deliveries',
        description: 'List courier delivery assignments with status.',
        sideEffect: 'READ',
        parameters: this.obj({}),
        execute: async () => {
          const res = await this.hris!.listDeliveries();
          return {
            count: (res.data ?? []).length,
            deliveries: (res.data ?? []).slice(-10).map((d) => ({
              orderNumber: d.orderNumber,
              courierName: d.courierName,
              status: d.status
            }))
          };
        }
      },
      {
        name: 'assess_staffing_and_act',
        description:
          'Run a full staffing assessment for the warehouse department. Computes warehouse/courier utilization, then AUTOMATICALLY assigns couriers to unshipped orders, creates overtime requests if overloaded, and escalates a ticket to humans if critical. This performs real database writes.',
        sideEffect: 'CRITICAL_WRITE',
        parameters: this.obj(
          {
            pendingOrders: { type: 'number', description: 'Number of orders awaiting fulfillment' },
            ordersReadyToShip: {
              type: 'array',
              description: 'Orders ready for courier assignment',
              items: {
                type: 'object',
                properties: { orderId: { type: 'string' }, orderNumber: { type: 'string' } }
              }
            }
          },
          ['pendingOrders']
        ),
        execute: async (args) => {
          if (!ctx.departmentId) return { error: 'No department configured' };
          const res = await this.hris!.assessStaffing({
            departmentId: ctx.departmentId,
            pendingOrders: Number(args.pendingOrders) || 0,
            ordersReadyToShip: (args.ordersReadyToShip as Array<{ orderId: string; orderNumber: string }>) ?? []
          });
          const d = res.data!;
          return {
            severity: d.severity,
            warehouseUtilization: d.warehouseUtilization,
            courierUtilization: d.courierUtilization,
            deliveriesAssigned: d.deliveryIds.length,
            overtimeRequestsCreated: d.overtimeRequestIds.length,
            escalationTicketId: d.escalationTicketId,
            hiringRecommendation: d.hiringRecommendation,
            actionsTaken: d.actionsTaken
          };
        }
      },
      {
        name: 'request_overtime',
        description: 'Create an overtime request for a specific employee. Real database write.',
        sideEffect: 'WRITE',
        parameters: this.obj(
          {
            employeeId: { type: 'string' },
            hours: { type: 'number', description: 'Overtime hours (1-8)' },
            reason: { type: 'string' }
          },
          ['employeeId', 'hours', 'reason']
        ),
        execute: async (args) => {
          const res = await this.hris!.requestOvertime({
            employeeId: String(args.employeeId),
            date: new Date().toISOString().slice(0, 10),
            hours: Math.max(1, Math.min(8, Number(args.hours) || 1)),
            reason: String(args.reason)
          });
          return { created: true, overtimeId: res.data?.id, hours: res.data?.hours, status: res.data?.status };
        }
      }
    ];
  }

  infraTools(): AgentTool[] {
    if (!this.infra) return [];
    const namespace = process.env.K8S_NAMESPACE || 'default';

    return [
      {
        name: 'get_cluster_snapshot',
        description: 'Get live Kubernetes cluster state: nodes, pods, deployments, services.',
        sideEffect: 'READ',
        parameters: this.obj({}),
        execute: async () => {
          const res = await this.infra!.getClusterSnapshot(namespace);
          const s = res.data;
          return {
            clusterName: s?.clusterName,
            nodes: s?.nodes?.length ?? 0,
            pods: s?.pods?.length ?? 0,
            deployments: (s?.deployments ?? []).map((d: any) => ({ name: d.name, replicas: d.replicas })),
            capturedAt: s?.capturedAt
          };
        }
      },
      {
        name: 'request_scaling',
        description:
          'Request a Kubernetes deployment scaling change. Creates a real ScalingEvent record subject to budget policy.',
        sideEffect: 'CRITICAL_WRITE',
        parameters: this.obj(
          {
            deploymentName: { type: 'string' },
            toReplicas: { type: 'number' },
            reason: { type: 'string' },
            projectedCostUsd: { type: 'number' }
          },
          ['deploymentName', 'toReplicas', 'reason']
        ),
        execute: async (args) => {
          const res = await this.infra!.requestScaling({
            namespace,
            deploymentName: String(args.deploymentName),
            toReplicas: Math.max(1, Math.min(20, Number(args.toReplicas) || 1)),
            reason: String(args.reason),
            projectedCostUsd: Number(args.projectedCostUsd) || 0.05
          });
          return {
            created: true,
            scalingEventId: res.data?.id,
            status: res.data?.status,
            action: res.data?.action
          };
        }
      },
      {
        name: 'list_scaling_events',
        description: 'List recent Kubernetes scaling events.',
        sideEffect: 'READ',
        parameters: this.obj({}),
        execute: async () => {
          const res = await this.infra!.listScalingEvents();
          return { count: (res.data ?? []).length, recent: (res.data ?? []).slice(-5) };
        }
      }
    ];
  }

  financeTools(): AgentTool[] {
    const tools: AgentTool[] = [];

    if (this.budget) {
      tools.push(
        {
          name: 'get_ai_budget_status',
          description: 'Get AI cognitive budget: daily/monthly spend, remaining, and whether limits are exceeded.',
          sideEffect: 'READ',
          parameters: this.obj({}),
          execute: async () => (await this.budget!.getStatus())
        },
        {
          name: 'get_agent_spend_breakdown',
          description: 'Get per-agent AI spend: cost, tokens, call count, average latency.',
          sideEffect: 'READ',
          parameters: this.obj({}),
          execute: async () => await this.budget!.getAgentUsageBreakdown()
        }
      );
    }

    if (this.ticketing) {
      tools.push({
        name: 'escalate_to_human',
        description:
          'Create a support ticket to escalate a decision to a human operator. Use when policy, budget, or risk requires approval.',
        sideEffect: 'CRITICAL_WRITE',
        parameters: this.obj(
          {
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }
          },
          ['title', 'description', 'priority']
        ),
        execute: async (args) => {
          const ticket = await this.ticketing!.createSystemTicket(
            String(args.title),
            String(args.description),
            'ai-agent',
            String(args.priority).toUpperCase() as any
          );
          return { created: true, ticketId: ticket.id, priority: ticket.priority, status: ticket.status };
        }
      });
    }

    return tools;
  }

  auditorTools(ctx: EnterpriseToolContext): AgentTool[] {
    const tools: AgentTool[] = [];

    if (this.auditService) {
      tools.push({
        name: 'audit_compliance_logs',
        description: 'Read and inspect recent audit records to verify compliance, actor identity, and system actions.',
        sideEffect: 'READ',
        parameters: this.obj({
          limit: { type: 'number', description: 'Number of recent log entries to retrieve (max 50)' }
        }),
        execute: async (args) => {
          const logs = this.auditService!.getLogs();
          const limit = Math.min(50, Number(args.limit) || 20);
          const recent = logs.slice(-limit);
          const failures = recent.filter((l) => l.status === 'FAILURE').length;
          const actions = recent.reduce((acc, l) => {
            acc[l.action] = (acc[l.action] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return {
            totalLogs: logs.length,
            inspected: recent.length,
            failures,
            actionDistribution: actions,
            recentSamples: recent.slice(-5).map((l) => ({
              auditId: l.auditId,
              action: l.action,
              actor: l.actor?.id,
              agent: l.agent,
              status: l.status,
              timestamp: l.timestamp
            }))
          };
        }
      });
    }

    tools.push({
      name: 'verify_domain_invariants',
      description: 'Audit cross-domain state consistency: verify that approved orders have stock reservations, active deliveries have valid couriers, and budgets are in bounds.',
      sideEffect: 'READ',
      parameters: this.obj({}),
      execute: async () => {
        const issues: string[] = [];

        if (this.sales && this.inventory) {
          try {
            const orders = (await this.sales.listSalesOrders()).data ?? [];
            const reservations = (await this.inventory.listReservations()).data ?? [];
            const approved = orders.filter((o) => o.status === 'APPROVED');
            if (approved.length > reservations.length) {
              issues.push(`Found ${approved.length} approved orders but only ${reservations.length} stock reservations`);
            }
          } catch (e: any) {
            issues.push(`Sales/Inventory audit check error: ${e?.message}`);
          }
        }

        if (this.hris) {
          try {
            const deliveries = (await this.hris.listDeliveries()).data ?? [];
            const orphaned = deliveries.filter((d) => !d.courierId && d.status !== DeliveryStatus.DELIVERED);
            if (orphaned.length > 0) {
              issues.push(`Found ${orphaned.length} deliveries without an assigned courier`);
            }
          } catch (e: any) {
            issues.push(`HRIS audit check error: ${e?.message}`);
          }
        }

        if (this.budget) {
          try {
            const status = await this.budget.getStatus();
            if (status.isDailyExceeded) {
              issues.push(`AI cognitive budget exceeded: daily used $${status.dailyUsedUsd} (remaining $${status.dailyRemainingUsd})`);
            }
          } catch (e: any) {
            issues.push(`Budget audit check error: ${e?.message}`);
          }
        }

        return {
          compliant: issues.length === 0,
          issueCount: issues.length,
          issues: issues.length > 0 ? issues : ['All audited cross-domain invariants hold.']
        };
      }
    });

    if (this.ticketing) {
      tools.push({
        name: 'flag_compliance_anomaly',
        description: 'Raise a formal compliance ticket when an audited domain violation or suspicious activity is detected.',
        sideEffect: 'CRITICAL_WRITE',
        parameters: this.obj(
          {
            title: { type: 'string', description: 'Brief summary of the compliance finding' },
            details: { type: 'string', description: 'Detailed evidence and audit trail' },
            severity: { type: 'string', enum: ['MEDIUM', 'HIGH', 'CRITICAL'] }
          },
          ['title', 'details']
        ),
        execute: async (args) => {
          const ticket = await this.ticketing!.createSystemTicket(
            `[AUDIT] ${args.title}`,
            String(args.details),
            'debugger-agent',
            (String(args.severity || 'HIGH').toUpperCase() as any)
          );
          return {
            created: true,
            ticketId: ticket.id,
            priority: ticket.priority,
            status: ticket.status
          };
        }
      });
    }

    return tools;
  }

  testerTools(ctx: EnterpriseToolContext): AgentTool[] {
    const tools: AgentTool[] = [];

    tools.push({
      name: 'run_synthetic_contract_probes',
      description: 'Execute synthetic non-mutating contract checks across Sales, Inventory, HRIS, and Infrastructure to verify API contracts and schema health.',
      sideEffect: 'READ',
      parameters: this.obj({}),
      execute: async () => {
        const probes: Array<{ domain: string; ok: boolean; latencyMs: number; error?: string }> = [];

        if (this.sales) {
          const t0 = Date.now();
          try {
            const res = await this.sales.getChannelSummary();
            probes.push({ domain: 'Sales', ok: Boolean(res.success), latencyMs: Date.now() - t0 });
          } catch (e: any) {
            probes.push({ domain: 'Sales', ok: false, latencyMs: Date.now() - t0, error: e?.message });
          }
        }

        if (this.inventory) {
          const t0 = Date.now();
          try {
            const res = await this.inventory.listProducts();
            probes.push({ domain: 'Inventory', ok: Boolean(res.success), latencyMs: Date.now() - t0 });
          } catch (e: any) {
            probes.push({ domain: 'Inventory', ok: false, latencyMs: Date.now() - t0, error: e?.message });
          }
        }

        if (this.hris) {
          const t0 = Date.now();
          try {
            const res = await this.hris.listEmployees();
            probes.push({ domain: 'HRIS', ok: Boolean(res.success), latencyMs: Date.now() - t0 });
          } catch (e: any) {
            probes.push({ domain: 'HRIS', ok: false, latencyMs: Date.now() - t0, error: e?.message });
          }
        }

        if (this.infra) {
          const t0 = Date.now();
          try {
            const res = await this.infra.listScalingEvents();
            probes.push({ domain: 'Infrastructure', ok: Boolean(res.success), latencyMs: Date.now() - t0 });
          } catch (e: any) {
            probes.push({ domain: 'Infrastructure', ok: false, latencyMs: Date.now() - t0, error: e?.message });
          }
        }

        const passed = probes.filter((p) => p.ok).length;
        const avgLatency = probes.length > 0 ? probes.reduce((s, p) => s + p.latencyMs, 0) / probes.length : 0;

        return {
          totalProbes: probes.length,
          passed,
          failed: probes.length - passed,
          avgLatencyMs: Math.round(avgLatency),
          probes
        };
      }
    });

    tools.push({
      name: 'verify_system_boundaries',
      description: 'Probe system health boundaries: verify service availability and contract adherence.',
      sideEffect: 'READ',
      parameters: this.obj({}),
      execute: async () => {
        const checks: Array<{ check: string; healthy: boolean }> = [];

        if (this.sales) {
          try {
            const orders = (await this.sales.listSalesOrders()).data ?? [];
            checks.push({ check: 'Sales Orders Access', healthy: Array.isArray(orders) });
          } catch {
            checks.push({ check: 'Sales Orders Access', healthy: false });
          }
        }

        if (this.hris) {
          try {
            const employees = (await this.hris.listEmployees()).data ?? [];
            checks.push({ check: 'HRIS Employees Access', healthy: Array.isArray(employees) });
          } catch {
            checks.push({ check: 'HRIS Employees Access', healthy: false });
          }
        }

        const allHealthy = checks.every((c) => c.healthy);
        return {
          allHealthy,
          checks
        };
      }
    });

    if (this.auditService) {
      tools.push({
        name: 'record_test_assertion',
        description: 'Record an automated synthetic verification assertion into the immutable audit record.',
        sideEffect: 'WRITE',
        parameters: this.obj(
          {
            testSuite: { type: 'string', description: 'Name of the test suite (e.g., ContractProbes, SystemBoundaries)' },
            passed: { type: 'boolean', description: 'Whether the assertion passed' },
            summary: { type: 'string', description: 'Summary of probe findings and latency' }
          },
          ['testSuite', 'passed', 'summary']
        ),
        execute: async (args) => {
          const rec = this.auditService!.record({
            agent: 'tester-agent',
            action: 'SYNTHETIC_TEST_ASSERTION',
            input: { testSuite: args.testSuite },
            output: { passed: args.passed, summary: args.summary },
            status: args.passed ? 'SUCCESS' : 'FAILURE',
            reasoning: String(args.summary)
          });
          return { recorded: Boolean(rec), auditId: rec?.auditId, status: rec?.status };
        }
      });
    }

    return tools;
  }
}
