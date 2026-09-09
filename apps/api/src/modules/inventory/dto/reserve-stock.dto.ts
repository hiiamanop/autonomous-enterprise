export class ReserveStockDto {
  warehouseId!: string;
  productId!: string;
  quantity!: number;
  idempotencyKey?: string;
  expiresAt?: string;
}
