import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InfrastructureService } from '../src/modules/infrastructure/infrastructure.service';
import { KubernetesClientService } from '../src/modules/infrastructure/k8s/kubernetes-client.service';
import { INFRASTRUCTURE_REPOSITORY } from '../src/modules/infrastructure/domain/infrastructure.repository.interface';
import { InMemoryInfrastructureRepository } from '../src/modules/infrastructure/infrastructure/in-memory-infrastructure.repository';
import { AuditService } from '../src/common/audit/audit.service';
import { PolicyEngineService } from '../src/common/policy/policy-engine.service';
import { FinanceService } from '../src/modules/finance/finance.service';
import { ConflictResolutionService } from '../src/common/orchestration/conflict-resolution.service';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import { ScalingEventStatus } from '@autonomous-enterprise/contracts';

describe('Infrastructure Module (Scaling Workflow)', () => {
  let service: InfrastructureService;
  let kubernetesClient: {
    isConfigured: ReturnType<typeof vi.fn>;
    getClusterSnapshot: ReturnType<typeof vi.fn>;
    getDeploymentReplicas: ReturnType<typeof vi.fn>;
    scaleDeployment: ReturnType<typeof vi.fn>;
  };
  let financeService: { checkBudgetAvailability: ReturnType<typeof vi.fn> };
  let conflictResolutionService: { detectAndResolve: ReturnType<typeof vi.fn> };

  const withTenant = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
    TenantContextStorage.run(
      { tenantId, actor: { id: 'sys', type: 'agent', tenantId, roles: [], permissions: [] } },
      fn
    );

  beforeEach(async () => {
    kubernetesClient = {
      isConfigured: vi.fn().mockReturnValue(true),
      getClusterSnapshot: vi.fn().mockResolvedValue({
        clusterName: 'kind-autonomous-enterprise',
        nodes: [{ name: 'node-1', status: 'Ready', cpuCapacity: '4', memoryCapacity: '8Gi', cpuAllocatable: '3.8', memoryAllocatable: '7.5Gi', kubeletVersion: 'v1.31.0' }],
        deployments: [{ name: 'sample-api-workload', namespace: 'autonomous-enterprise', replicas: 2, readyReplicas: 2, availableReplicas: 2, image: 'nginx:1.27-alpine' }],
        pods: [],
        services: [],
        capturedAt: new Date().toISOString()
      }),
      getDeploymentReplicas: vi.fn().mockResolvedValue(2),
      scaleDeployment: vi.fn().mockResolvedValue(undefined)
    };
    financeService = { checkBudgetAvailability: vi.fn().mockResolvedValue(true) };
    conflictResolutionService = {
      detectAndResolve: vi.fn().mockResolvedValue({
        conflict: { id: 'c1', tenantId: 't', partyA: {}, partyB: {}, status: 'ESCALATED', createdAt: '' },
        resolved: false,
        escalated: true,
        ticketId: 'tkt-infra-1'
      })
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InfrastructureService,
        AuditService,
        PolicyEngineService,
        { provide: INFRASTRUCTURE_REPOSITORY, useClass: InMemoryInfrastructureRepository },
        { provide: KubernetesClientService, useValue: kubernetesClient },
        { provide: FinanceService, useValue: financeService },
        { provide: ConflictResolutionService, useValue: conflictResolutionService }
      ]
    }).compile();

    service = moduleRef.get(InfrastructureService);
  });

  it('should observe the cluster and return a snapshot', async () => {
    await withTenant('tenant-infra-1', async () => {
      const res = await service.getClusterSnapshot('autonomous-enterprise');
      expect(res.success).toBe(true);
      expect(res.data?.deployments[0].name).toBe('sample-api-workload');
    });
  });

  it('should reject cluster snapshot when kubernetes client is not configured', async () => {
    kubernetesClient.isConfigured.mockReturnValue(false);
    await withTenant('tenant-infra-2', async () => {
      await expect(service.getClusterSnapshot('autonomous-enterprise')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  it('should auto-approve and execute a scale-up within replica limit, budget, and confidence threshold', async () => {
    await withTenant('tenant-infra-3', async () => {
      const res = await service.requestScaling({
        namespace: 'autonomous-enterprise',
        deploymentName: 'sample-api-workload',
        toReplicas: 4,
        reason: 'Flash sale traffic increase',
        projectedCostUsd: 5,
        budgetId: 'budget-1'
      });

      expect(res.data?.status).toBe(ScalingEventStatus.EXECUTED);
      expect(res.data?.fromReplicas).toBe(2);
      expect(res.data?.toReplicas).toBe(4);
      expect(res.data?.action).toBe('SCALE_UP');
      expect(kubernetesClient.scaleDeployment).toHaveBeenCalledWith(
        'autonomous-enterprise',
        'sample-api-workload',
        4
      );
    });
  });

  it('should reject scaling when requested replicas exceed tenant maximum', async () => {
    await withTenant('tenant-infra-4', async () => {
      const res = await service.requestScaling({
        namespace: 'autonomous-enterprise',
        deploymentName: 'sample-api-workload',
        toReplicas: 50,
        reason: 'Unbounded scale attempt',
        projectedCostUsd: 100
      });

      expect(res.data?.status).toBe(ScalingEventStatus.POLICY_REJECTED);
      expect(kubernetesClient.scaleDeployment).not.toHaveBeenCalled();
    });
  });

  it('should reject scale-up when budget is insufficient', async () => {
    financeService.checkBudgetAvailability.mockResolvedValue(false);
    await withTenant('tenant-infra-5', async () => {
      const res = await service.requestScaling({
        namespace: 'autonomous-enterprise',
        deploymentName: 'sample-api-workload',
        toReplicas: 5,
        reason: 'Traffic spike',
        projectedCostUsd: 50,
        budgetId: 'budget-2'
      });

      expect(res.data?.status).toBe(ScalingEventStatus.POLICY_REJECTED);
      expect(kubernetesClient.scaleDeployment).not.toHaveBeenCalled();
    });
  });

  it('should roll back an executed scaling event to its original replica count', async () => {
    await withTenant('tenant-infra-6', async () => {
      const requested = await service.requestScaling({
        namespace: 'autonomous-enterprise',
        deploymentName: 'sample-api-workload',
        toReplicas: 6,
        reason: 'Growth',
        projectedCostUsd: 2
      });
      expect(requested.data?.status).toBe(ScalingEventStatus.EXECUTED);

      const rolledBack = await service.rollbackScaling(requested.data!.id);
      expect(rolledBack.data?.status).toBe(ScalingEventStatus.ROLLED_BACK);
      expect(kubernetesClient.scaleDeployment).toHaveBeenLastCalledWith(
        'autonomous-enterprise',
        'sample-api-workload',
        2
      );
    });
  });

  it('should not allow rollback of a scaling event that was never executed', async () => {
    await withTenant('tenant-infra-7', async () => {
      const rejected = await service.requestScaling({
        namespace: 'autonomous-enterprise',
        deploymentName: 'sample-api-workload',
        toReplicas: 50,
        reason: 'Invalid',
        projectedCostUsd: 100
      });

      await expect(service.rollbackScaling(rejected.data!.id)).rejects.toThrow(BadRequestException);
    });
  });

  it('should throw NotFoundException for scaling event id that does not exist', async () => {
    await withTenant('tenant-infra-8', async () => {
      await expect(service.getScalingEvent('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  it('should list scaling events across the enterprise', async () => {
    await withTenant('tenant-infra-a', async () => {
      await service.requestScaling({
        namespace: 'autonomous-enterprise',
        deploymentName: 'sample-api-workload',
        toReplicas: 3,
        reason: 'Enterprise scaling',
        projectedCostUsd: 1
      });
    });

    await withTenant('tenant-infra-b', async () => {
      const events = await service.listScalingEvents();
      expect(events.data).toHaveLength(1);
      expect(events.data?.[0].reason).toBe('Enterprise scaling');
    });
  });
});
