import type {
  PrismaClient,
  ScalingEvent as PrismaScalingEvent,
  ScalingAction as PrismaScalingAction,
  ScalingEventStatus as PrismaScalingEventStatus,
  CloudCostRecord as PrismaCloudCostRecord
} from '@prisma/client';

export type ScalingActionEnum = 'SCALE_UP' | 'SCALE_DOWN';
export type ScalingEventStatusEnum =
  | 'REQUESTED'
  | 'APPROVED'
  | 'POLICY_APPROVED'
  | 'POLICY_REJECTED'
  | 'EXECUTED'
  | 'FAILED'
  | 'ESCALATED'
  | 'ROLLED_BACK';

export interface ScalingEventEntity {
  id: string;
  workflowId?: string;
  clusterName: string;
  namespace: string;
  deploymentName: string;
  action: ScalingActionEnum;
  fromReplicas: number;
  toReplicas: number;
  reason: string;
  projectedCostUsd: number;
  status: ScalingEventStatusEnum;
  policyReasons: string[];
  executedAt?: string;
  rolledBackAt?: string;
  ticketId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudCostRecordEntity {
  id: string;
  clusterName: string;
  namespace: string;
  resourceName: string;
  costUsd: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface IInfrastructureRepository {
  createScalingEvent(event: ScalingEventEntity): Promise<ScalingEventEntity>;
  updateScalingEvent(event: ScalingEventEntity): Promise<ScalingEventEntity>;
  findScalingEventById(id: string): Promise<ScalingEventEntity | null>;
  findAllScalingEvents(deploymentName?: string): Promise<ScalingEventEntity[]>;

  createCloudCostRecord(record: CloudCostRecordEntity): Promise<CloudCostRecordEntity>;
  findCloudCostRecords(periodStart?: string, periodEnd?: string): Promise<CloudCostRecordEntity[]>;
}

export class PrismaInfrastructureRepository implements IInfrastructureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapScalingEvent(raw: PrismaScalingEvent): ScalingEventEntity {
    return {
      id: raw.id,
      workflowId: raw.workflowId ?? undefined,
      clusterName: raw.clusterName,
      namespace: raw.namespace,
      deploymentName: raw.deploymentName,
      action: raw.action as ScalingActionEnum,
      fromReplicas: raw.fromReplicas,
      toReplicas: raw.toReplicas,
      reason: raw.reason,
      projectedCostUsd: raw.projectedCostUsd,
      status: raw.status as ScalingEventStatusEnum,
      policyReasons: raw.policyReasons,
      executedAt: raw.executedAt ? raw.executedAt.toISOString() : undefined,
      rolledBackAt: raw.rolledBackAt ? raw.rolledBackAt.toISOString() : undefined,
      ticketId: raw.ticketId ?? undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapCloudCost(raw: PrismaCloudCostRecord): CloudCostRecordEntity {
    return {
      id: raw.id,
      clusterName: raw.clusterName,
      namespace: raw.namespace,
      resourceName: raw.resourceName,
      costUsd: raw.costUsd,
      periodStart: raw.periodStart.toISOString(),
      periodEnd: raw.periodEnd.toISOString(),
      createdAt: raw.createdAt.toISOString()
    };
  }

  async createScalingEvent(event: ScalingEventEntity): Promise<ScalingEventEntity> {
    const created = await this.prisma.scalingEvent.create({
      data: {
        id: event.id,
        workflowId: event.workflowId,
        clusterName: event.clusterName,
        namespace: event.namespace,
        deploymentName: event.deploymentName,
        action: event.action as PrismaScalingAction,
        fromReplicas: event.fromReplicas,
        toReplicas: event.toReplicas,
        reason: event.reason,
        projectedCostUsd: event.projectedCostUsd,
        status: (event.status === 'POLICY_APPROVED' ? 'APPROVED' : event.status === 'POLICY_REJECTED' ? 'FAILED' : event.status) as PrismaScalingEventStatus,
        policyReasons: event.policyReasons || [],
        executedAt: event.executedAt ? new Date(event.executedAt) : undefined,
        rolledBackAt: event.rolledBackAt ? new Date(event.rolledBackAt) : undefined,
        ticketId: event.ticketId,
        createdAt: event.createdAt ? new Date(event.createdAt) : undefined,
        updatedAt: event.updatedAt ? new Date(event.updatedAt) : undefined
      }
    });
    return this.mapScalingEvent(created);
  }

  async updateScalingEvent(event: ScalingEventEntity): Promise<ScalingEventEntity> {
    const updated = await this.prisma.scalingEvent.update({
      where: { id: event.id },
      data: {
        status: (event.status === 'POLICY_APPROVED' ? 'APPROVED' : event.status === 'POLICY_REJECTED' ? 'FAILED' : event.status) as PrismaScalingEventStatus,
        policyReasons: event.policyReasons || [],
        executedAt: event.executedAt ? new Date(event.executedAt) : undefined,
        rolledBackAt: event.rolledBackAt ? new Date(event.rolledBackAt) : undefined,
        ticketId: event.ticketId,
        updatedAt: new Date()
      }
    });
    return this.mapScalingEvent(updated);
  }

  async findScalingEventById(id: string): Promise<ScalingEventEntity | null> {
    const found = await this.prisma.scalingEvent.findUnique({
      where: { id }
    });
    return found ? this.mapScalingEvent(found) : null;
  }

  async findAllScalingEvents(deploymentName?: string): Promise<ScalingEventEntity[]> {
    const events = await this.prisma.scalingEvent.findMany({
      where: {
        deploymentName: deploymentName || undefined
      },
      orderBy: { createdAt: 'desc' }
    });
    return events.map((e) => this.mapScalingEvent(e));
  }

  async createCloudCostRecord(record: CloudCostRecordEntity): Promise<CloudCostRecordEntity> {
    const created = await this.prisma.cloudCostRecord.create({
      data: {
        id: record.id,
        clusterName: record.clusterName,
        namespace: record.namespace,
        resourceName: record.resourceName,
        costUsd: record.costUsd,
        periodStart: new Date(record.periodStart),
        periodEnd: new Date(record.periodEnd),
        createdAt: record.createdAt ? new Date(record.createdAt) : undefined
      }
    });
    return this.mapCloudCost(created);
  }

  async findCloudCostRecords(periodStart?: string, periodEnd?: string): Promise<CloudCostRecordEntity[]> {
    const records = await this.prisma.cloudCostRecord.findMany({
      where: {
        periodStart: periodStart ? { gte: new Date(periodStart) } : undefined,
        periodEnd: periodEnd ? { lte: new Date(periodEnd) } : undefined
      },
      orderBy: { periodStart: 'desc' }
    });
    return records.map((r) => this.mapCloudCost(r));
  }
}
