import type {
  PrismaClient,
  Product as PrismaProduct,
  Warehouse as PrismaWarehouse,
  Stock as PrismaStock,
  StockMovement as PrismaStockMovement,
  StockReservation as PrismaStockReservation,
  ReorderRule as PrismaReorderRule,
  StockMovementType as PrismaStockMovementType,
  StockReservationStatus as PrismaStockReservationStatus
} from '@prisma/client';

export interface ProductEntity {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseEntity {
  id: string;
  code: string;
  name: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockEntity {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  updatedAt: string;
}

export type StockMovementTypeEnum = 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'TRANSFER' | 'IN' | 'OUT' | 'RESERVATION' | 'RELEASE';

export interface StockMovementEntity {
  id: string;
  warehouseId: string;
  productId: string;
  type: StockMovementTypeEnum;
  quantity: number;
  reference?: string;
  notes?: string;
  reason?: string;
  createdAt: string;
}

export type StockReservationStatusEnum = 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED' | 'RELEASED';

export interface StockReservationEntity {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  status: StockReservationStatusEnum;
  idempotencyKey?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReorderRuleEntity {
  id: string;
  warehouseId: string;
  productId: string;
  minQuantity: number;
  reorderQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface IInventoryRepository {
  createProduct(product: ProductEntity): Promise<ProductEntity>;
  findProductById(id: string): Promise<ProductEntity | null>;
  findProductBySku(sku: string): Promise<ProductEntity | null>;
  findAllProducts(): Promise<ProductEntity[]>;

  createWarehouse(warehouse: WarehouseEntity): Promise<WarehouseEntity>;
  findWarehouseById(id: string): Promise<WarehouseEntity | null>;
  findAllWarehouses(): Promise<WarehouseEntity[]>;

  setStock(stock: StockEntity): Promise<StockEntity>;
  findStock(warehouseId: string, productId: string): Promise<StockEntity | null>;
  findAllStock(): Promise<StockEntity[]>;

  createMovement(movement: StockMovementEntity): Promise<StockMovementEntity>;
  findMovements(warehouseId?: string, productId?: string): Promise<StockMovementEntity[]>;

  findReservationById(id: string): Promise<StockReservationEntity | null>;
  findReservationByIdempotencyKey(idempotencyKey: string): Promise<StockReservationEntity | null>;
  saveReservation(reservation: StockReservationEntity): Promise<StockReservationEntity>;
  findAllReservations(): Promise<StockReservationEntity[]>;

  createReorderRule(rule: ReorderRuleEntity): Promise<ReorderRuleEntity>;
  findReorderRules(warehouseId?: string, productId?: string): Promise<ReorderRuleEntity[]>;
}

export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapProduct(raw: PrismaProduct): ProductEntity {
    return {
      id: raw.id,
      sku: raw.sku,
      name: raw.name,
      price: raw.price,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapWarehouse(raw: PrismaWarehouse): WarehouseEntity {
    return {
      id: raw.id,
      code: raw.code,
      name: raw.name,
      location: raw.location ?? undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapStock(raw: PrismaStock): StockEntity {
    return {
      id: raw.id,
      warehouseId: raw.warehouseId,
      productId: raw.productId,
      quantity: raw.quantity,
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapMovement(raw: PrismaStockMovement): StockMovementEntity {
    return {
      id: raw.id,
      warehouseId: raw.warehouseId,
      productId: raw.productId,
      type: raw.type as StockMovementTypeEnum,
      quantity: raw.quantity,
      reference: raw.reference ?? undefined,
      reason: raw.reason ?? undefined,
      createdAt: raw.createdAt.toISOString()
    };
  }

  private mapReservation(raw: PrismaStockReservation): StockReservationEntity {
    return {
      id: raw.id,
      warehouseId: raw.warehouseId,
      productId: raw.productId,
      quantity: raw.quantity,
      status: raw.status as StockReservationStatusEnum,
      idempotencyKey: raw.idempotencyKey ?? undefined,
      expiresAt: raw.expiresAt ? raw.expiresAt.toISOString() : undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapReorderRule(raw: PrismaReorderRule): ReorderRuleEntity {
    return {
      id: raw.id,
      warehouseId: raw.warehouseId,
      productId: raw.productId,
      minQuantity: raw.minQuantity,
      reorderQuantity: raw.reorderQuantity,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async createProduct(product: ProductEntity): Promise<ProductEntity> {
    const created = await this.prisma.product.create({
      data: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        createdAt: product.createdAt ? new Date(product.createdAt) : undefined,
        updatedAt: product.updatedAt ? new Date(product.updatedAt) : undefined
      }
    });
    return this.mapProduct(created);
  }

  async findProductById(id: string): Promise<ProductEntity | null> {
    const found = await this.prisma.product.findUnique({
      where: { id }
    });
    return found ? this.mapProduct(found) : null;
  }

  async findProductBySku(sku: string): Promise<ProductEntity | null> {
    const found = await this.prisma.product.findUnique({
      where: { sku }
    });
    return found ? this.mapProduct(found) : null;
  }

  async findAllProducts(): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return products.map((p) => this.mapProduct(p));
  }

  async createWarehouse(warehouse: WarehouseEntity): Promise<WarehouseEntity> {
    const created = await this.prisma.warehouse.create({
      data: {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        location: warehouse.location || '',
        createdAt: warehouse.createdAt ? new Date(warehouse.createdAt) : undefined,
        updatedAt: warehouse.updatedAt ? new Date(warehouse.updatedAt) : undefined
      }
    });
    return this.mapWarehouse(created);
  }

  async findWarehouseById(id: string): Promise<WarehouseEntity | null> {
    const found = await this.prisma.warehouse.findUnique({
      where: { id }
    });
    return found ? this.mapWarehouse(found) : null;
  }

  async findAllWarehouses(): Promise<WarehouseEntity[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return warehouses.map((w) => this.mapWarehouse(w));
  }

  async setStock(stock: StockEntity): Promise<StockEntity> {
    const upserted = await this.prisma.stock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: stock.warehouseId,
          productId: stock.productId
        }
      },
      create: {
        id: stock.id,
        warehouseId: stock.warehouseId,
        productId: stock.productId,
        quantity: stock.quantity,
        updatedAt: stock.updatedAt ? new Date(stock.updatedAt) : undefined
      },
      update: {
        quantity: stock.quantity,
        updatedAt: stock.updatedAt ? new Date(stock.updatedAt) : undefined
      }
    });
    return this.mapStock(upserted);
  }

  async findStock(warehouseId: string, productId: string): Promise<StockEntity | null> {
    const found = await this.prisma.stock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId,
          productId
        }
      }
    });
    return found ? this.mapStock(found) : null;
  }

  async findAllStock(): Promise<StockEntity[]> {
    const stocks = await this.prisma.stock.findMany();
    return stocks.map((s) => this.mapStock(s));
  }

  async createMovement(movement: StockMovementEntity): Promise<StockMovementEntity> {
    let movementType: PrismaStockMovementType;
    if (movement.type === 'IN' || movement.type === 'INBOUND') {
      movementType = 'INBOUND';
    } else if (movement.type === 'OUT' || movement.type === 'OUTBOUND') {
      movementType = 'OUTBOUND';
    } else if (movement.type === 'TRANSFER') {
      movementType = 'TRANSFER';
    } else {
      movementType = 'ADJUSTMENT';
    }

    const created = await this.prisma.stockMovement.create({
      data: {
        id: movement.id,
        warehouseId: movement.warehouseId,
        productId: movement.productId,
        type: movementType,
        quantity: movement.quantity,
        reference: movement.reference || 'SYSTEM_MOVEMENT',
        reason: movement.reason || movement.notes,
        createdAt: movement.createdAt ? new Date(movement.createdAt) : undefined
      }
    });
    return this.mapMovement(created);
  }

  async findMovements(warehouseId?: string, productId?: string): Promise<StockMovementEntity[]> {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        warehouseId: warehouseId || undefined,
        productId: productId || undefined
      },
      orderBy: { createdAt: 'desc' }
    });
    return movements.map((m) => this.mapMovement(m));
  }

  async findReservationById(id: string): Promise<StockReservationEntity | null> {
    const found = await this.prisma.stockReservation.findUnique({
      where: { id }
    });
    return found ? this.mapReservation(found) : null;
  }

  async findReservationByIdempotencyKey(idempotencyKey: string): Promise<StockReservationEntity | null> {
    const found = await this.prisma.stockReservation.findFirst({
      where: { idempotencyKey }
    });
    return found ? this.mapReservation(found) : null;
  }

  async saveReservation(reservation: StockReservationEntity): Promise<StockReservationEntity> {
    let reservationStatus: PrismaStockReservationStatus;
    if (reservation.status === 'CONFIRMED' || reservation.status === 'FULFILLED') {
      reservationStatus = 'CONFIRMED';
    } else if (reservation.status === 'CANCELLED') {
      reservationStatus = 'CANCELLED';
    } else if (reservation.status === 'RELEASED') {
      reservationStatus = 'RELEASED';
    } else {
      reservationStatus = 'PENDING';
    }

    const upserted = await this.prisma.stockReservation.upsert({
      where: { id: reservation.id },
      create: {
        id: reservation.id,
        warehouseId: reservation.warehouseId,
        productId: reservation.productId,
        quantity: reservation.quantity,
        status: reservationStatus,
        idempotencyKey: reservation.idempotencyKey,
        expiresAt: reservation.expiresAt ? new Date(reservation.expiresAt) : undefined,
        createdAt: reservation.createdAt ? new Date(reservation.createdAt) : undefined,
        updatedAt: reservation.updatedAt ? new Date(reservation.updatedAt) : undefined
      },
      update: {
        quantity: reservation.quantity,
        status: reservationStatus,
        idempotencyKey: reservation.idempotencyKey,
        expiresAt: reservation.expiresAt ? new Date(reservation.expiresAt) : undefined,
        updatedAt: reservation.updatedAt ? new Date(reservation.updatedAt) : undefined
      }
    });
    return this.mapReservation(upserted);
  }

  async findAllReservations(): Promise<StockReservationEntity[]> {
    const reservations = await this.prisma.stockReservation.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return reservations.map((r) => this.mapReservation(r));
  }

  async createReorderRule(rule: ReorderRuleEntity): Promise<ReorderRuleEntity> {
    const created = await this.prisma.reorderRule.create({
      data: {
        id: rule.id,
        warehouseId: rule.warehouseId,
        productId: rule.productId,
        minQuantity: rule.minQuantity,
        reorderQuantity: rule.reorderQuantity,
        createdAt: rule.createdAt ? new Date(rule.createdAt) : undefined,
        updatedAt: rule.updatedAt ? new Date(rule.updatedAt) : undefined
      }
    });
    return this.mapReorderRule(created);
  }

  async findReorderRules(warehouseId?: string, productId?: string): Promise<ReorderRuleEntity[]> {
    const rules = await this.prisma.reorderRule.findMany({
      where: {
        warehouseId: warehouseId || undefined,
        productId: productId || undefined
      }
    });
    return rules.map((r) => this.mapReorderRule(r));
  }
}
