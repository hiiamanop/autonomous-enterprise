export interface RecordGoodsReceiptDto {
  purchaseOrderId: string;
  receivedQuantity: number;
  warehouseId: string;
  receivedAt?: string;
}
