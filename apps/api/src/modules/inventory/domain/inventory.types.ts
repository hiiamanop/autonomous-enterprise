export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stock {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  updatedAt: string;
}

export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'RESERVATION' | 'RELEASE' | 'INBOUND' | 'OUTBOUND' | 'TRANSFER';

export interface StockMovement {
  id: string;
  warehouseId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export type StockReservationStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED' | 'CONFIRMED' | 'RELEASED';

export interface StockReservation {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  status: StockReservationStatus;
  idempotencyKey?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReorderRule {
  id: string;
  warehouseId: string;
  productId: string;
  minQuantity: number;
  reorderQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityResult {
  productId: string;
  warehouseId: string;
  availableQuantity: number;
  requestedQuantity: number;
  isAvailable: boolean;
}
