import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { OmniRouterClient } from '../src/common/ai-provider/omnirouter.client';
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

describe('Failure recovery and graceful degradation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fail closed with ServiceUnavailableException when AI provider is absent', async () => {
    delete process.env.OMNIROUTER_BASE_URL;
    delete process.env.OMNIROUTER_API_KEY;
    delete process.env.API_URL_AI_PROVIDER;
    delete process.env.PROVIDER_API_KEY;

    const client = new OmniRouterClient();
    await expect(
      client.complete({ model: 'reasoning-model', prompt: 'sensitive business decision' })
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('should fail closed with ServiceUnavailableException when AI provider returns an error', async () => {
    process.env.OMNIROUTER_BASE_URL = 'http://127.0.0.1:1';
    process.env.OMNIROUTER_API_KEY = 'test-key';

    const client = new OmniRouterClient();
    await expect(client.complete({ model: 'reasoning-model', prompt: 'test' })).rejects.toThrow();
  });

  it('should persist FAILED scaling event and rethrow when Kubernetes scale operation fails', async () => {
    const kubernetesClient = {
      isConfigured: vi.fn().mockReturnValue(true),
      getDeploymentReplicas: vi.fn().mockResolvedValue(2),
      scaleDeployment: vi.fn().mockRejectedValue(new Error('Kubernetes API unreachable'))
    };
    const financeService = { checkBudgetAvailability: vi.fn().mockResolvedValue(true) };
    const conflictResolutionService = { detectAndResolve: vi.fn() };

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

    const service = moduleRef.get(InfrastructureService);
    const repository = moduleRef.get<InMemoryInfrastructureRepository>(INFRASTRUCTURE_REPOSITORY);

    await TenantContextStorage.run(
      {
        tenantId: 'tenant-k8s-failure',
        actor: { id: 'infra-agent', type: 'agent', tenantId: 'tenant-k8s-failure', roles: [], permissions: [] }
      },
      async () => {
        await expect(
          service.requestScaling({
            namespace: 'autonomous-enterprise',
            deploymentName: 'sample-api-workload',
            toReplicas: 4,
            reason: 'traffic spike',
            projectedCostUsd: 2
          })
        ).rejects.toThrow('Kubernetes API unreachable');

        const events = await repository.findAllScalingEvents();
        expect(events).toHaveLength(1);
        expect(events[0].status).toBe(ScalingEventStatus.FAILED);
      }
    );
  });

  it('should reject infrastructure action before Kubernetes call when client is unconfigured', async () => {
    const kubernetesClient = {
      isConfigured: vi.fn().mockReturnValue(false),
      getDeploymentReplicas: vi.fn(),
      scaleDeployment: vi.fn()
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InfrastructureService,
        AuditService,
        PolicyEngineService,
        { provide: INFRASTRUCTURE_REPOSITORY, useClass: InMemoryInfrastructureRepository },
        { provide: KubernetesClientService, useValue: kubernetesClient },
        { provide: FinanceService, useValue: { checkBudgetAvailability: vi.fn() } },
        { provide: ConflictResolutionService, useValue: { detectAndResolve: vi.fn() } }
      ]
    }).compile();

    const service = moduleRef.get(InfrastructureService);

    await TenantContextStorage.run(
      {
        tenantId: 'tenant-k8s-unconfigured',
        actor: { id: 'infra-agent', type: 'agent', tenantId: 'tenant-k8s-unconfigured', roles: [], permissions: [] }
      },
      async () => {
        await expect(
          service.requestScaling({
            namespace: 'autonomous-enterprise',
            deploymentName: 'sample-api-workload',
            toReplicas: 4,
            reason: 'traffic spike',
            projectedCostUsd: 2
          })
        ).rejects.toThrow('Kubernetes client is not configured');
        expect(kubernetesClient.getDeploymentReplicas).not.toHaveBeenCalled();
        expect(kubernetesClient.scaleDeployment).not.toHaveBeenCalled();
      }
    );
  });
});
