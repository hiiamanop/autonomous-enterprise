import { Injectable, Logger } from '@nestjs/common';
import * as k8s from '@kubernetes/client-node';
import type {
  ClusterNode,
  ClusterSnapshot,
  WorkloadDeployment,
  WorkloadPod,
  WorkloadService
} from '@autonomous-enterprise/contracts';

@Injectable()
export class KubernetesClientService {
  private readonly logger = new Logger(KubernetesClientService.name);
  private kc: k8s.KubeConfig | undefined;
  private coreApi: k8s.CoreV1Api | undefined;
  private appsApi: k8s.AppsV1Api | undefined;

  private getClients(): { core: k8s.CoreV1Api; apps: k8s.AppsV1Api; clusterName: string } {
    if (!this.kc) {
      this.kc = new k8s.KubeConfig();
      if (process.env.KUBECONFIG_PATH) {
        this.kc.loadFromFile(process.env.KUBECONFIG_PATH);
      } else {
        this.kc.loadFromDefault();
      }
      this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
      this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    }
    return {
      core: this.coreApi!,
      apps: this.appsApi!,
      clusterName: this.kc.getCurrentContext()
    };
  }

  isConfigured(): boolean {
    try {
      this.getClients();
      return true;
    } catch (error) {
      this.logger.warn(`Kubernetes client not configured: ${(error as Error).message}`);
      return false;
    }
  }

  async getClusterSnapshot(namespace: string): Promise<ClusterSnapshot> {
    const { core, apps, clusterName } = this.getClients();

    const [nodesResponse, podsResponse, deploymentsResponse, servicesResponse] = await Promise.all([
      core.listNode(),
      core.listNamespacedPod({ namespace }),
      apps.listNamespacedDeployment({ namespace }),
      core.listNamespacedService({ namespace })
    ]);

    const nodes: ClusterNode[] = (nodesResponse.items ?? []).map((node) => ({
      name: node.metadata?.name ?? 'unknown',
      status:
        node.status?.conditions?.find((condition) => condition.type === 'Ready')?.status === 'True'
          ? 'Ready'
          : 'NotReady',
      cpuCapacity: node.status?.capacity?.['cpu'] ?? 'unknown',
      memoryCapacity: node.status?.capacity?.['memory'] ?? 'unknown',
      cpuAllocatable: node.status?.allocatable?.['cpu'] ?? 'unknown',
      memoryAllocatable: node.status?.allocatable?.['memory'] ?? 'unknown',
      kubeletVersion: node.status?.nodeInfo?.kubeletVersion ?? 'unknown'
    }));

    const pods: WorkloadPod[] = (podsResponse.items ?? []).map((pod) => {
      const container = pod.spec?.containers?.[0];
      return {
        name: pod.metadata?.name ?? 'unknown',
        namespace: pod.metadata?.namespace ?? namespace,
        status: pod.status?.phase ?? 'Unknown',
        restartCount: pod.status?.containerStatuses?.[0]?.restartCount ?? 0,
        cpuRequest: container?.resources?.requests?.['cpu'],
        memoryRequest: container?.resources?.requests?.['memory'],
        cpuLimit: container?.resources?.limits?.['cpu'],
        memoryLimit: container?.resources?.limits?.['memory'],
        createdAt: pod.metadata?.creationTimestamp
          ? new Date(pod.metadata.creationTimestamp).toISOString()
          : undefined
      };
    });

    const deployments: WorkloadDeployment[] = (deploymentsResponse.items ?? []).map((deployment) => ({
      name: deployment.metadata?.name ?? 'unknown',
      namespace: deployment.metadata?.namespace ?? namespace,
      replicas: deployment.spec?.replicas ?? 0,
      readyReplicas: deployment.status?.readyReplicas ?? 0,
      availableReplicas: deployment.status?.availableReplicas ?? 0,
      image: deployment.spec?.template?.spec?.containers?.[0]?.image ?? 'unknown'
    }));

    const services: WorkloadService[] = (servicesResponse.items ?? []).map((service) => ({
      name: service.metadata?.name ?? 'unknown',
      namespace: service.metadata?.namespace ?? namespace,
      type: service.spec?.type ?? 'ClusterIP',
      clusterIp: service.spec?.clusterIP ?? 'none',
      ports: (service.spec?.ports ?? []).map((port) => port.port)
    }));

    return {
      clusterName,
      nodes,
      deployments,
      pods,
      services,
      capturedAt: new Date().toISOString()
    };
  }

  async getDeploymentReplicas(namespace: string, deploymentName: string): Promise<number> {
    const { apps } = this.getClients();
    const deployment = await apps.readNamespacedDeployment({ name: deploymentName, namespace });
    return deployment.spec?.replicas ?? 0;
  }

  async scaleDeployment(namespace: string, deploymentName: string, replicas: number): Promise<void> {
    const { apps } = this.getClients();
    await apps.patchNamespacedDeploymentScale(
      { name: deploymentName, namespace, body: { spec: { replicas } } },
      k8s.setHeaderOptions('Content-Type', k8s.PatchStrategy.MergePatch)
    );
  }
}
