export interface CreatePurchaseRequestDto {
  requestedBy: string;
  productId: string;
  quantity: number;
  reason?: string;
}
