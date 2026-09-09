import { Injectable } from '@nestjs/common';
import type {
  Product,
  Warehouse,
  Stock,
  StockMovement,
  StockReservation,
  ReorderRule
} from '../domain/inventory.types';
import type { IInventoryRepository } from '../domain/inventory.repository.interface';

@Injectable()
export class InMemoryInventoryRepository implements IInventoryRepository {
  private readonly products: Map<string, Product> = new Map();
  private readonly warehouses: Map<string, Warehouse> = new Map();
  private readonly stockMap: Map<string, Stock> = new Map();
  private readonly movements: StockMovement[] = [];
  private readonly reservations: Map<string, StockReservation> = new Map();
  private readonly reorderRules: Map<string, ReorderRule> = new Map();

  async createProduct(product: Product): Promise<Product> {
    this.products.set(product.id, { ...product });
    return { ...product };
  }

  async findProductById(id: string): Promise<Product | null> {
    const p = this.products.get(id);
    return p ? { ...p } : null;
  }

  async findProductBySku(sku: string): Promise<Product | null> {
    for (const p of this.products.values()) {
      if (p.sku === sku) {
        return { ...p };
      }
    }
    return null;
  }

  async findAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).map((p) => ({ ...p }));
  }

  async createWarehouse(warehouse: Warehouse): Promise<Warehouse> {
    this.warehouses.set(warehouse.id, { ...warehouse });
    return { ...warehouse };
  }

  async findWarehouseById(id: string): Promise<Warehouse | null> {
    const w = this.warehouses.get(id);
    return w ? { ...w } : null;
  }

  async findAllWarehouses(): Promise<Warehouse[]> {
    return Array.from(this.warehouses.values()).map((w) => ({ ...w }));
  }

  async setStock(stock: Stock): Promise<Stock> {
    const key = `${stock.warehouseId}:${stock.productId}`;
    this.stockMap.set(key, { ...stock });
    return { ...stock };
  }

  async findStock(warehouseId: string, productId: string): Promise<Stock | null> {
    const key = `${warehouseId}:${productId}`;
    const s = this.stockMap.get(key);
    return s ? { ...s } : null;
  }

  async findAllStock(): Promise<Stock[]> {
    return Array.from(this.stockMap.values()).map((s) => ({ ...s }));
  }

  async createMovement(movement: StockMovement): Promise<StockMovement> {
    this.movements.push({ ...movement });
    return { ...movement };
  }

  async findMovements(warehouseId?: string, productId?: string): Promise<StockMovement[]> {
    return this.movements
      .filter((m) => {
        if (warehouseId && m.warehouseId !== warehouseId) return false;
        if (productId && m.productId !== productId) return false;
        return true;
      })
      .map((m) => ({ ...m }));
  }

  async findReservationById(id: string): Promise<StockReservation | null> {
    const r = this.reservations.get(id);
    return r ? { ...r } : null;
  }

  async findReservationByIdempotencyKey(idempotencyKey: string): Promise<StockReservation | null> {
    for (const r of this.reservations.values()) {
      if (r.idempotencyKey === idempotencyKey) {
        return { ...r };
      }
    }
    return null;
  }

  async saveReservation(reservation: StockReservation): Promise<StockReservation> {
    this.reservations.set(reservation.id, { ...reservation });
    return { ...reservation };
  }

  async findAllReservations(): Promise<StockReservation[]> {
    return Array.from(this.reservations.values()).map((r) => ({ ...r }));
  }

  async createReorderRule(rule: ReorderRule): Promise<ReorderRule> {
    this.reorderRules.set(rule.id, { ...rule });
    return { ...rule };
  }

  async findReorderRules(warehouseId?: string, productId?: string): Promise<ReorderRule[]> {
    return Array.from(this.reorderRules.values())
      .filter((r) => {
        if (warehouseId && r.warehouseId !== warehouseId) return false;
        if (productId && r.productId !== productId) return false;
        return true;
      })
      .map((r) => ({ ...r }));
  }
}
