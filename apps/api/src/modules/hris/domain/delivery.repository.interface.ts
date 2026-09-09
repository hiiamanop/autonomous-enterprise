import type { Delivery } from '@autonomous-enterprise/contracts';

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');

export interface IDeliveryRepository {
  create(delivery: Delivery): Promise<Delivery>;
  findById(id: string): Promise<Delivery | null>;
  findAll(): Promise<Delivery[]>;
  findByOrderId(orderId: string): Promise<Delivery | null>;
  findActiveByCourier(courierId: string): Promise<Delivery[]>;
  update(delivery: Delivery): Promise<Delivery>;
}
