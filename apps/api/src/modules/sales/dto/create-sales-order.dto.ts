export interface CreateSalesOrderItemDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

import type { SalesChannel } from '@autonomous-enterprise/contracts';

export interface CreateSalesOrderDto {
  customerId: string;
  items: CreateSalesOrderItemDto[];
  discountAmount?: number;
  notes?: string;
  idempotencyKey?: string;
  channel?: SalesChannel;
  assignedRepId?: string;
}
