import { Injectable } from '@nestjs/common';
import type { SalesOrder } from '@autonomous-enterprise/contracts';
import type { ISalesOrderRepository } from '../domain/sales-order.repository.interface';

@Injectable()
export class InMemorySalesOrderRepository implements ISalesOrderRepository {
  private readonly orders: Map<string, SalesOrder> = new Map();

  async create(order: SalesOrder): Promise<SalesOrder> {
    this.orders.set(order.id, { ...order });
    return { ...order };
  }

  async findById(id: string): Promise<SalesOrder | null> {
    const order = this.orders.get(id);
    return order ? { ...order } : null;
  }

  async findByIdempotencyKey(key: string): Promise<SalesOrder | null> {
    for (const order of this.orders.values()) {
      if (order.idempotencyKey === key) {
        return { ...order };
      }
    }
    return null;
  }

  async findAll(): Promise<SalesOrder[]> {
    return Array.from(this.orders.values()).map((o) => ({ ...o }));
  }

  async update(order: SalesOrder): Promise<SalesOrder> {
    if (!this.orders.has(order.id)) {
      throw new Error(`Sales order ${order.id} not found`);
    }
    this.orders.set(order.id, { ...order });
    return { ...order };
  }
}
