export class ProcessOrderFulfillmentDto {
  salesOrderId!: string;
  warehouseId!: string;
  idempotencyKey?: string;
}
