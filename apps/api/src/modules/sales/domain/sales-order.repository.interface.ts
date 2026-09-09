import type { SalesOrder } from '@autonomous-enterprise/contracts';

export interface ISalesOrderRepository {
  create(order: SalesOrder): Promise<SalesOrder>;
  findById(id: string): Promise<SalesOrder | null>;
  findByIdempotencyKey(key: string): Promise<SalesOrder | null>;
  findAll(): Promise<SalesOrder[]>;
  update(order: SalesOrder): Promise<SalesOrder>;
}

export const SALES_ORDER_REPOSITORY = 'SALES_ORDER_REPOSITORY';
