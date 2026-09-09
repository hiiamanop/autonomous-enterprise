import type { CloudCostRecord, ScalingEvent } from '@autonomous-enterprise/contracts';

export interface IInfrastructureRepository {
  createScalingEvent(event: ScalingEvent): Promise<ScalingEvent>;
  updateScalingEvent(event: ScalingEvent): Promise<ScalingEvent>;
  findScalingEventById(id: string): Promise<ScalingEvent | null>;
  findAllScalingEvents(deploymentName?: string): Promise<ScalingEvent[]>;

  createCloudCostRecord(record: CloudCostRecord): Promise<CloudCostRecord>;
  findAllCloudCostRecords(clusterName?: string): Promise<CloudCostRecord[]>;
}

export const INFRASTRUCTURE_REPOSITORY = 'INFRASTRUCTURE_REPOSITORY';
