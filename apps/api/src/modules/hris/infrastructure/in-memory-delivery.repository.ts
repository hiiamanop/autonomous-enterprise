import { Injectable } from '@nestjs/common';
import { DeliveryStatus, type Delivery } from '@autonomous-enterprise/contracts';
import type { IDeliveryRepository } from '../domain/delivery.repository.interface';

@Injectable()
export class InMemoryDeliveryRepository implements IDeliveryRepository {
  private readonly deliveries: Map<string, Delivery> = new Map();

  async create(delivery: Delivery): Promise<Delivery> {
    this.deliveries.set(delivery.id, { ...delivery });
    return { ...delivery };
  }

  async findById(id: string): Promise<Delivery | null> {
    const found = this.deliveries.get(id);
    return found ? { ...found } : null;
  }

  async findAll(): Promise<Delivery[]> {
    return Array.from(this.deliveries.values()).map((d) => ({ ...d }));
  }

  async findByOrderId(orderId: string): Promise<Delivery | null> {
    for (const delivery of this.deliveries.values()) {
      if (delivery.orderId === orderId) {
        return { ...delivery };
      }
    }
    return null;
  }

  async findActiveByCourier(courierId: string): Promise<Delivery[]> {
    return Array.from(this.deliveries.values())
      .filter(
        (d) =>
          d.courierId === courierId &&
          (d.status === DeliveryStatus.ASSIGNED || d.status === DeliveryStatus.IN_TRANSIT)
      )
      .map((d) => ({ ...d }));
  }

  async update(delivery: Delivery): Promise<Delivery> {
    this.deliveries.set(delivery.id, { ...delivery });
    return { ...delivery };
  }
}
