import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ApiResponse, ClusterSnapshot, ScalingEvent } from '@autonomous-enterprise/contracts';
import { ScalingAction, ScalingEventStatus } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PolicyEngineService } from '../../common/policy/policy-engine.service';
import { FinanceService } from '../finance/finance.service';
import { ConflictResolutionService } from '../../common/orchestration/conflict-resolution.service';
import {
  INFRASTRUCTURE_REPOSITORY,
  type IInfrastructureRepository
} from './domain/infrastructure.repository.interface';
import { KubernetesClientService } from './k8s/kubernetes-client.service';
import type { RequestScalingDto } from './dto/request-scaling.dto';

const DEFAULT_MAX_REPLICAS = 10;
const DEFAULT_MIN_CONFIDENCE_THRESHOLD = 0.6;

@Injectable()
export class InfrastructureService {
  constructor(
    @Inject(INFRASTRUCTURE_REPOSITORY)
    private readonly repository: IInfrastructureRepository,
    @Inject(KubernetesClientService)
    private readonly kubernetesClient: KubernetesClientService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(PolicyEngineService) private readonly policyEngine: PolicyEngineService,
    @Inject(FinanceService) private readonly financeService: FinanceService,
    @Optional()
    @Inject(ConflictResolutionService)
    private readonly conflictResolutionService?: ConflictResolutionService
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  private assertKubernetesConfigured(): void {
    if (this.kubernetesClient.isConfigured && !this.kubernetesClient.isConfigured()) {
      throw new BadRequestException('Kubernetes client is not configured');
    }
  }

  async getClusterSnapshot(namespace = 'default'): Promise<ApiResponse<ClusterSnapshot>> {
    this.assertKubernetesConfigured();
    const snapshot = await this.kubernetesClient.getClusterSnapshot(namespace);
    return {
      success: true,
      data: snapshot,
      metadata: this.buildMetadata()
    };
  }

  async requestScaling(dto: RequestScalingDto): Promise<ApiResponse<ScalingEvent>> {
    const namespace = dto.namespace || 'default';
    const deploymentName = dto.deploymentName;

    if (!deploymentName) {
      throw new BadRequestException('Deployment name is required');
    }

    if (dto.toReplicas === undefined || dto.toReplicas < 0) {
      throw new BadRequestException('Target replicas must be a non-negative number');
    }

    this.assertKubernetesConfigured();

    if (dto.toReplicas > DEFAULT_MAX_REPLICAS) {
      const now = new Date().toISOString();
      const rejectedEvent: ScalingEvent = {
        id: randomUUID(),
        workflowId: dto.workflowId,
        clusterName: process.env.K8S_CLUSTER_NAME || 'local-kind-ae',
        namespace,
        deploymentName,
        action: ScalingAction.SCALE_UP,
        fromReplicas: 0,
        toReplicas: dto.toReplicas,
        reason: dto.reason,
        projectedCostUsd: dto.projectedCostUsd || 0.05,
        status: ScalingEventStatus.POLICY_REJECTED,
        policyReasons: [
          `Target replicas (${dto.toReplicas}) exceeds maximum allowed limit (${DEFAULT_MAX_REPLICAS})`
        ],
        createdAt: now,
        updatedAt: now
      };

      const savedRejected = await this.repository.createScalingEvent(rejectedEvent);
      this.auditService.record({
        action: 'REQUEST_SCALING',
        status: 'REJECTED',
        input: dto,
        output: savedRejected,
        policyEvaluation: { allowed: false, reason: savedRejected.policyReasons.join(', ') }
      });

      return {
        success: false,
        data: savedRejected,
        error: {
          code: 'SCALING_POLICY_VIOLATION',
          message: savedRejected.policyReasons.join('; ')
        },
        metadata: this.buildMetadata()
      };
    }

    const currentReplicas = await this.kubernetesClient.getDeploymentReplicas(namespace, deploymentName);
    const action = dto.toReplicas >= currentReplicas ? ScalingAction.SCALE_UP : ScalingAction.SCALE_DOWN;
    const projectedCostUsd = dto.projectedCostUsd || 0.05;

    const policyReasons: string[] = [];

    let budgetAvailable = true;
    if (action === ScalingAction.SCALE_UP && dto.budgetId) {
      budgetAvailable = await this.financeService.checkBudgetAvailability(dto.budgetId, projectedCostUsd);
      if (!budgetAvailable) {
        policyReasons.push(
          `Insufficient budget [${dto.budgetId}] for projected scaling cost $${projectedCostUsd}`
        );
      }
    }

    const policyResult = this.policyEngine.evaluateInfrastructureScalingPolicy({
      requestedReplicas: dto.toReplicas,
      maxReplicas: DEFAULT_MAX_REPLICAS,
      isScaleUp: action === ScalingAction.SCALE_UP,
      budgetAvailable,
      projectedCostUsd,
      confidence: dto.confidence ?? 1.0,
      minConfidenceThreshold: DEFAULT_MIN_CONFIDENCE_THRESHOLD
    });

    if (policyResult.decision === 'REJECT') {
      policyReasons.push(...policyResult.reasons);
    }

    const confidence = dto.confidence ?? 1.0;
    if (confidence < DEFAULT_MIN_CONFIDENCE_THRESHOLD) {
      policyReasons.push(
        `Model confidence (${confidence}) is below minimum threshold (${DEFAULT_MIN_CONFIDENCE_THRESHOLD})`
      );
    }

    const hasPolicyViolation = policyReasons.length > 0;

    const scalingEvent: ScalingEvent = {
      id: randomUUID(),
      workflowId: dto.workflowId,
      clusterName: process.env.K8S_CLUSTER_NAME || 'local-kind-ae',
      namespace,
      deploymentName,
      action,
      fromReplicas: currentReplicas,
      toReplicas: dto.toReplicas,
      reason: dto.reason,
      projectedCostUsd,
      status: hasPolicyViolation ? ScalingEventStatus.POLICY_REJECTED : ScalingEventStatus.REQUESTED,
      policyReasons,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.createScalingEvent(scalingEvent);

    this.auditService.record({
      action: 'REQUEST_SCALING',
      status: hasPolicyViolation ? 'FAILURE' : 'SUCCESS',
      input: dto,
      output: saved,
      policyEvaluation: {
        allowed: !hasPolicyViolation,
        reason: policyReasons.join(', ') || undefined
      }
    });

    if (hasPolicyViolation) {
      return {
        success: false,
        data: saved,
        error: {
          code: 'SCALING_POLICY_VIOLATION',
          message: `Scaling request rejected: ${policyReasons.join('; ')}`
        },
        metadata: this.buildMetadata()
      };
    }

    try {
      await this.kubernetesClient.scaleDeployment(namespace, deploymentName, dto.toReplicas);
      saved.status = ScalingEventStatus.EXECUTED;
      saved.executedAt = new Date().toISOString();
      saved.updatedAt = new Date().toISOString();
      await this.repository.updateScalingEvent(saved);
    } catch (err: any) {
      saved.status = ScalingEventStatus.FAILED;
      saved.policyReasons.push(`Execution failed: ${err.message}`);
      saved.updatedAt = new Date().toISOString();
      await this.repository.updateScalingEvent(saved);

      throw err;
    }

    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async rollbackScaling(eventId: string): Promise<ApiResponse<ScalingEvent>> {
    const event = await this.repository.findScalingEventById(eventId);
    if (!event) {
      throw new NotFoundException(`Scaling event with ID [${eventId}] not found`);
    }

    if (event.status !== ScalingEventStatus.EXECUTED) {
      throw new BadRequestException(`Cannot rollback scaling event in status [${event.status}]`);
    }

    await this.kubernetesClient.scaleDeployment(event.namespace, event.deploymentName, event.fromReplicas);

    event.status = ScalingEventStatus.ROLLED_BACK;
    event.rolledBackAt = new Date().toISOString();
    event.updatedAt = new Date().toISOString();
    const updated = await this.repository.updateScalingEvent(event);

    this.auditService.record({
      action: 'ROLLBACK_SCALING',
      status: 'SUCCESS',
      input: { eventId },
      output: updated
    });

    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async getScalingEvent(id: string): Promise<ApiResponse<ScalingEvent>> {
    const event = await this.repository.findScalingEventById(id);
    if (!event) {
      throw new NotFoundException(`Scaling event with ID [${id}] not found`);
    }
    return {
      success: true,
      data: event,
      metadata: this.buildMetadata()
    };
  }

  async listScalingEvents(deploymentName?: string): Promise<ApiResponse<ScalingEvent[]>> {
    const events = await this.repository.findAllScalingEvents(deploymentName);
    return {
      success: true,
      data: events,
      metadata: this.buildMetadata()
    };
  }
}
