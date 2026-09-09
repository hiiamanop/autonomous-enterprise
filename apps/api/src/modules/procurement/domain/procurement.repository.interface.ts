import type {
  Supplier,
  PurchaseRequest,
  PurchaseOrder,
  SupplierQuotation,
  GoodsReceipt
} from './procurement.types';

export interface IProcurementRepository {
  createSupplier(supplier: Supplier): Promise<Supplier>;
  findSupplierById(id: string): Promise<Supplier | null>;
  findSupplierByName(name: string): Promise<Supplier | null>;
  findAllSuppliers(): Promise<Supplier[]>;
  updateSupplier(supplier: Supplier): Promise<Supplier>;

  createPurchaseRequest(request: PurchaseRequest): Promise<PurchaseRequest>;
  findPurchaseRequestById(id: string): Promise<PurchaseRequest | null>;
  findAllPurchaseRequests(): Promise<PurchaseRequest[]>;
  updatePurchaseRequest(request: PurchaseRequest): Promise<PurchaseRequest>;

  createPurchaseOrder(order: PurchaseOrder): Promise<PurchaseOrder>;
  findPurchaseOrderById(id: string): Promise<PurchaseOrder | null>;
  findPurchaseOrderByIdempotencyKey(idempotencyKey: string): Promise<PurchaseOrder | null>;
  findAllPurchaseOrders(): Promise<PurchaseOrder[]>;
  updatePurchaseOrder(order: PurchaseOrder): Promise<PurchaseOrder>;

  createSupplierQuotation(quotation: SupplierQuotation): Promise<SupplierQuotation>;
  findSupplierQuotations(productId?: string, supplierId?: string): Promise<SupplierQuotation[]>;

  createGoodsReceipt(receipt: GoodsReceipt): Promise<GoodsReceipt>;
  findGoodsReceiptsByPurchaseOrderId(purchaseOrderId: string): Promise<GoodsReceipt[]>;
  findAllGoodsReceipts(): Promise<GoodsReceipt[]>;
}

export const PROCUREMENT_REPOSITORY = 'PROCUREMENT_REPOSITORY';
