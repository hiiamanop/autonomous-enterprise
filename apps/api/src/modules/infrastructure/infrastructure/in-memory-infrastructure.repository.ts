import { Injectable } from '@nestjs/common';
import type { CloudCostRecord, ScalingEvent } from '@autonomous-enterprise/contracts';
import type { IInfrastructureRepository } from '../domain/infrastructure.repository.interface';

@Injectable()
export class InMemoryInfrastructureRepository implements IInfrastructureRepository {
  private readonly events: Map<string, ScalingEvent> = new Map();
  private readonly costRecords: Map<string, CloudCostRecord> = new Map();

  async createScalingEvent(event: ScalingEvent): Promise<ScalingEvent> {
    this.events.set(event.id, { ...event });
    return { ...event };
  }

  async updateScalingEvent(event: ScalingEvent): Promise<ScalingEvent> {
    this.events.set(event.id, { ...event });
    return { ...event };
  }

  async findScalingEventById(id: string): Promise<ScalingEvent | null> {
    const event = this.events.get(id);
    return event ? { ...event } : null;
  }

  async findAllScalingEvents(deploymentName?: string): Promise<ScalingEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => {
        if (deploymentName && e.deploymentName !== deploymentName) return false;
        return true;
      })
      .map((e) => ({ ...e }));
  }

  async createCloudCostRecord(record: CloudCostRecord): Promise<CloudCostRecord> {
    this.costRecords.set(record.id, { ...record });
    return { ...record };
  }

  async findAllCloudCostRecords(clusterName?: string): Promise<CloudCostRecord[]> {
    return Array.from(this.costRecords.values())
      .filter((c) => {
        if (clusterName && c.clusterName !== clusterName) return false;
        return true;
      })
      .map((c) => ({ ...c }));
  }
}
