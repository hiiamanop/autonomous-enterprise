export interface CreateSupplierQuotationDto {
  supplierId: string;
  productId: string;
  unitPrice: number;
  validUntil?: string;
}
