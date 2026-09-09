export interface Supplier {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED';

export interface PurchaseRequest {
  id: string;
  requestedBy: string;
  productId: string;
  quantity: number;
  status: PurchaseRequestStatus;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  purchaseRequestId?: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  idempotencyKey?: string;
  items?: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierQuotation {
  id: string;
  supplierId: string;
  productId: string;
  unitPrice: number;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceipt {
  id: string;
  purchaseOrderId: string;
  receivedQuantity: number;
  warehouseId: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}
