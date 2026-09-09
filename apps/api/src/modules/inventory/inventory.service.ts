import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import type {
  Product,
  Warehouse,
  Stock,
  StockMovement,
  StockReservation,
  ReorderRule,
  AvailabilityResult
} from './domain/inventory.types';
import {
  INVENTORY_REPOSITORY,
  type IInventoryRepository
} from './domain/inventory.repository.interface';
import type { CreateProductDto } from './dto/create-product.dto';
import type { CreateWarehouseDto } from './dto/create-warehouse.dto';
import type { SetStockDto } from './dto/set-stock.dto';
import type { ReserveStockDto } from './dto/reserve-stock.dto';
import type { CreateReorderRuleDto } from './dto/create-reorder-rule.dto';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly repository: IInventoryRepository
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async createProduct(dto: CreateProductDto): Promise<ApiResponse<Product>> {
    if (!dto.sku || !dto.name) {
      throw new BadRequestException('Product SKU and name are required');
    }
    if (dto.price !== undefined && dto.price < 0) {
      throw new BadRequestException('Product price cannot be negative');
    }

    const existing = await this.repository.findProductBySku(dto.sku);
    if (existing) {
      throw new BadRequestException(`Product with SKU [${dto.sku}] already exists`);
    }

    const product: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sku: dto.sku,
      name: dto.name,
      description: dto.description,
      price: dto.price ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.createProduct(product);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    const product = await this.repository.findProductById(id);
    if (!product) {
      throw new NotFoundException(`Product [${id}] not found`);
    }
    return {
      success: true,
      data: product,
      metadata: this.buildMetadata()
    };
  }

  async listProducts(): Promise<ApiResponse<Product[]>> {
    const products = await this.repository.findAllProducts();
    return {
      success: true,
      data: products,
      metadata: this.buildMetadata()
    };
  }

  async createWarehouse(dto: CreateWarehouseDto): Promise<ApiResponse<Warehouse>> {
    if (!dto.code || !dto.name) {
      throw new BadRequestException('Warehouse code and name are required');
    }

    const warehouse: Warehouse = {
      id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      code: dto.code,
      name: dto.name,
      location: dto.location,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.createWarehouse(warehouse);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async getWarehouse(id: string): Promise<ApiResponse<Warehouse>> {
    const warehouse = await this.repository.findWarehouseById(id);
    if (!warehouse) {
      throw new NotFoundException(`Warehouse [${id}] not found`);
    }
    return {
      success: true,
      data: warehouse,
      metadata: this.buildMetadata()
    };
  }

  async listWarehouses(): Promise<ApiResponse<Warehouse[]>> {
    const warehouses = await this.repository.findAllWarehouses();
    return {
      success: true,
      data: warehouses,
      metadata: this.buildMetadata()
    };
  }

  async setStock(dto: SetStockDto): Promise<ApiResponse<Stock>> {
    if (!dto.warehouseId || !dto.productId) {
      throw new BadRequestException('Warehouse ID and Product ID are required');
    }
    if (dto.quantity < 0) {
      throw new BadRequestException('Stock quantity cannot be negative');
    }

    const warehouse = await this.repository.findWarehouseById(dto.warehouseId);
    if (!warehouse) {
      throw new NotFoundException(`Warehouse [${dto.warehouseId}] not found`);
    }

    const product = await this.repository.findProductById(dto.productId);
    if (!product) {
      throw new NotFoundException(`Product [${dto.productId}] not found`);
    }

    const existingStock = await this.repository.findStock(dto.warehouseId, dto.productId);
    const oldQty = existingStock ? existingStock.quantity : 0;
    const reservedQty = existingStock ? existingStock.reservedQuantity : 0;

    if (dto.quantity < reservedQty) {
      throw new BadRequestException(
        `Cannot set physical stock (${dto.quantity}) below currently reserved quantity (${reservedQty})`
      );
    }

    const stock: Stock = {
      id: existingStock?.id ?? `stock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      quantity: dto.quantity,
      reservedQuantity: reservedQty,
      availableQuantity: dto.quantity - reservedQty,
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.setStock(stock);

    const diff = dto.quantity - oldQty;
    if (diff !== 0) {
      const movement: StockMovement = {
        id: `move-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        type: diff > 0 ? 'IN' : 'OUT',
        quantity: Math.abs(diff),
        reference: 'MANUAL_SET_STOCK',
        notes: `Physical count adjustment from ${oldQty} to ${dto.quantity}`,
        createdAt: new Date().toISOString()
      };
      await this.repository.createMovement(movement);
    }

    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async checkAvailability(
    warehouseId: string,
    productId: string,
    requestedQuantity: number
  ): Promise<ApiResponse<AvailabilityResult>> {
    if (requestedQuantity <= 0) {
      throw new BadRequestException('Requested quantity must be positive');
    }

    const stock = await this.repository.findStock(warehouseId, productId);
    const available = stock ? stock.availableQuantity : 0;

    const result: AvailabilityResult = {
      productId,
      warehouseId,
      availableQuantity: available,
      requestedQuantity,
      isAvailable: available >= requestedQuantity
    };

    return {
      success: true,
      data: result,
      metadata: this.buildMetadata()
    };
  }

  async reserveStock(dto: ReserveStockDto): Promise<ApiResponse<StockReservation>> {
    if (dto.idempotencyKey) {
      const existingRes = await this.repository.findReservationByIdempotencyKey(dto.idempotencyKey);
      if (existingRes) {
        return {
          success: true,
          data: existingRes,
          metadata: this.buildMetadata()
        };
      }
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('Reservation quantity must be greater than zero');
    }

    const stock = await this.repository.findStock(dto.warehouseId, dto.productId);
    if (!stock) {
      throw new NotFoundException(`Stock record for Product [${dto.productId}] at Warehouse [${dto.warehouseId}] not found`);
    }

    if (stock.availableQuantity < dto.quantity) {
      throw new BadRequestException(
        `Insufficient available stock for reservation. Requested: ${dto.quantity}, Available: ${stock.availableQuantity}`
      );
    }

    stock.reservedQuantity += dto.quantity;
    stock.availableQuantity = stock.quantity - stock.reservedQuantity;
    stock.updatedAt = new Date().toISOString();
    await this.repository.setStock(stock);

    const reservation: StockReservation = {
      id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      quantity: dto.quantity,
      status: 'PENDING',
      idempotencyKey: dto.idempotencyKey,
      expiresAt: dto.expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const savedReservation = await this.repository.saveReservation(reservation);

    const movement: StockMovement = {
      id: `move-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      type: 'RESERVATION',
      quantity: dto.quantity,
      reference: savedReservation.id,
      notes: `Stock reserved via reservation [${savedReservation.id}]`,
      createdAt: new Date().toISOString()
    };
    await this.repository.createMovement(movement);

    return {
      success: true,
      data: savedReservation,
      metadata: this.buildMetadata()
    };
  }

  async cancelReservation(id: string): Promise<ApiResponse<StockReservation>> {
    const reservation = await this.repository.findReservationById(id);
    if (!reservation) {
      throw new NotFoundException(`StockReservation [${id}] not found`);
    }
    if (reservation.status !== 'CANCELLED') {
      const stock = await this.repository.findStock(reservation.warehouseId, reservation.productId);
      if (stock) {
        stock.reservedQuantity = Math.max(0, stock.reservedQuantity - reservation.quantity);
        stock.availableQuantity = stock.quantity - stock.reservedQuantity;
        stock.updatedAt = new Date().toISOString();
        await this.repository.setStock(stock);
      }
      reservation.status = 'CANCELLED';
      reservation.updatedAt = new Date().toISOString();
      await this.repository.saveReservation(reservation);
    }
    return { success: true, data: reservation, metadata: this.buildMetadata() };
  }

  async listReservations(): Promise<ApiResponse<StockReservation[]>> {
    const reservations = await this.repository.findAllReservations();
    return {
      success: true,
      data: reservations,
      metadata: this.buildMetadata()
    };
  }

  async listMovements(warehouseId?: string, productId?: string): Promise<ApiResponse<StockMovement[]>> {
    const movements = await this.repository.findMovements(warehouseId, productId);
    return {
      success: true,
      data: movements,
      metadata: this.buildMetadata()
    };
  }

  async createReorderRule(dto: CreateReorderRuleDto): Promise<ApiResponse<ReorderRule>> {
    const rule: ReorderRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      minQuantity: dto.minQuantity,
      reorderQuantity: dto.reorderQuantity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.createReorderRule(rule);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async listReorderRules(warehouseId?: string, productId?: string): Promise<ApiResponse<ReorderRule[]>> {
    const rules = await this.repository.findReorderRules(warehouseId, productId);
    return {
      success: true,
      data: rules,
      metadata: this.buildMetadata()
    };
  }
}
