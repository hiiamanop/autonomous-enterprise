import type {
  Product,
  Warehouse,
  Stock,
  StockMovement,
  StockReservation,
  ReorderRule
} from './inventory.types';

export interface IInventoryRepository {
  createProduct(product: Product): Promise<Product>;
  findProductById(id: string): Promise<Product | null>;
  findProductBySku(sku: string): Promise<Product | null>;
  findAllProducts(): Promise<Product[]>;

  createWarehouse(warehouse: Warehouse): Promise<Warehouse>;
  findWarehouseById(id: string): Promise<Warehouse | null>;
  findAllWarehouses(): Promise<Warehouse[]>;

  setStock(stock: Stock): Promise<Stock>;
  findStock(warehouseId: string, productId: string): Promise<Stock | null>;
  findAllStock(): Promise<Stock[]>;

  createMovement(movement: StockMovement): Promise<StockMovement>;
  findMovements(warehouseId?: string, productId?: string): Promise<StockMovement[]>;

  findReservationById(id: string): Promise<StockReservation | null>;
  findReservationByIdempotencyKey(idempotencyKey: string): Promise<StockReservation | null>;
  saveReservation(reservation: StockReservation): Promise<StockReservation>;
  findAllReservations(): Promise<StockReservation[]>;

  createReorderRule(rule: ReorderRule): Promise<ReorderRule>;
  findReorderRules(warehouseId?: string, productId?: string): Promise<ReorderRule[]>;
}

export const INVENTORY_REPOSITORY = 'INVENTORY_REPOSITORY';
