export interface CreatePurchaseOrderItemDto {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreatePurchaseOrderDto {
  supplierId: string;
  purchaseRequestId?: string;
  items: CreatePurchaseOrderItemDto[];
  idempotencyKey?: string;
}
