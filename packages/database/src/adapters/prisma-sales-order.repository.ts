import {
  SalesOrder,
  SalesOrderStatus,
  SalesOrderItem,
  SalesChannel
} from '@autonomous-enterprise/contracts';
import type {
  PrismaClient,
  SalesOrder as PrismaSalesOrder,
  SalesOrderItem as PrismaSalesOrderItem,
  SalesOrderStatus as PrismaSalesOrderStatus
} from '@prisma/client';

export interface ISalesOrderRepository {
  create(order: SalesOrder): Promise<SalesOrder>;
  findById(id: string): Promise<SalesOrder | null>;
  findByIdempotencyKey(key: string): Promise<SalesOrder | null>;
  findAll(): Promise<SalesOrder[]>;
  update(order: SalesOrder): Promise<SalesOrder>;
}

type SalesOrderWithItems = PrismaSalesOrder & {
  items: PrismaSalesOrderItem[];
};

export class PrismaSalesOrderRepository implements ISalesOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDomain(raw: SalesOrderWithItems): SalesOrder {
    return {
      id: raw.id,
      customerId: raw.customerId,
      orderNumber: raw.orderNumber,
      items: raw.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        totalPrice: item.totalPrice
      })),
      subtotal: raw.subtotal,
      discountAmount: raw.discountAmount,
      totalAmount: raw.totalAmount,
      channel: (raw as any).channel ?? SalesChannel.MARKETPLACE,
      assignedRepId: (raw as any).assignedRepId ?? undefined,
      leadOutcome: (raw as any).leadOutcome ?? undefined,
      status: raw.status as SalesOrderStatus,
      idempotencyKey: raw.idempotencyKey ?? undefined,
      notes: raw.notes ?? undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async create(order: SalesOrder): Promise<SalesOrder> {
    const created = await this.prisma.salesOrder.create({
      data: {
        id: order.id,
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        totalAmount: order.totalAmount,
        status: order.status as PrismaSalesOrderStatus,
        idempotencyKey: order.idempotencyKey,
        notes: order.notes,
        createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
        updatedAt: order.updatedAt ? new Date(order.updatedAt) : undefined,
        items: {
          create: (order.items || []).map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            totalPrice: item.totalPrice
          }))
        }
      },
      include: {
        items: true
      }
    });

    return this.mapToDomain(created);
  }

  async findById(id: string): Promise<SalesOrder | null> {
    const found = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    return found ? this.mapToDomain(found) : null;
  }

  async findByIdempotencyKey(key: string): Promise<SalesOrder | null> {
    const found = await this.prisma.salesOrder.findFirst({
      where: { idempotencyKey: key },
      include: { items: true }
    });

    return found ? this.mapToDomain(found) : null;
  }

  async findAll(): Promise<SalesOrder[]> {
    const orders = await this.prisma.salesOrder.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    return orders.map((o) => this.mapToDomain(o));
  }

  async update(order: SalesOrder): Promise<SalesOrder> {
    await this.prisma.salesOrderItem.deleteMany({
      where: { salesOrderId: order.id }
    });

    const updated = await this.prisma.salesOrder.update({
      where: { id: order.id },
      data: {
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        totalAmount: order.totalAmount,
        status: order.status as PrismaSalesOrderStatus,
        idempotencyKey: order.idempotencyKey,
        notes: order.notes,
        items: {
          create: (order.items || []).map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            totalPrice: item.totalPrice
          }))
        }
      },
      include: {
        items: true
      }
    });

    return this.mapToDomain(updated);
  }
}
