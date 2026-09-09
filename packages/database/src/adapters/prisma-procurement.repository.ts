import type {
  PrismaClient,
  Supplier as PrismaSupplier,
  PurchaseRequest as PrismaPurchaseRequest,
  PurchaseOrder as PrismaPurchaseOrder,
  PurchaseOrderItem as PrismaPurchaseOrderItem,
  SupplierQuotation as PrismaSupplierQuotation,
  GoodsReceipt as PrismaGoodsReceipt,
  PurchaseRequestStatus as PrismaPurchaseRequestStatus,
  PurchaseOrderStatus as PrismaPurchaseOrderStatus
} from '@prisma/client';

export interface SupplierEntity {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseRequestStatusEnum = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED';

export interface PurchaseRequestEntity {
  id: string;
  requestedBy: string;
  productId: string;
  quantity: number;
  status: PurchaseRequestStatusEnum;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatusEnum =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface PurchaseOrderItemEntity {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrderEntity {
  id: string;
  supplierId: string;
  purchaseRequestId?: string;
  orderNumber: string;
  status: PurchaseOrderStatusEnum;
  totalAmount: number;
  idempotencyKey?: string;
  items?: PurchaseOrderItemEntity[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierQuotationEntity {
  id: string;
  supplierId: string;
  productId: string;
  unitPrice: number;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptEntity {
  id: string;
  purchaseOrderId: string;
  receivedQuantity: number;
  warehouseId: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export class PrismaProcurementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapSupplier(raw: PrismaSupplier): SupplierEntity {
    return {
      id: raw.id,
      name: raw.name,
      contactEmail: raw.contactEmail ?? undefined,
      contactPhone: raw.contactPhone ?? undefined,
      isVerified: raw.isVerified,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapPurchaseRequest(raw: PrismaPurchaseRequest): PurchaseRequestEntity {
    return {
      id: raw.id,
      requestedBy: raw.requestedBy,
      productId: raw.productId,
      quantity: raw.quantity,
      status: raw.status as PurchaseRequestStatusEnum,
      reason: raw.reason ?? undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapPurchaseOrder(
    raw: PrismaPurchaseOrder & { items?: PrismaPurchaseOrderItem[] }
  ): PurchaseOrderEntity {
    return {
      id: raw.id,
      supplierId: raw.supplierId,
      orderNumber: raw.orderNumber,
      status: raw.status as PurchaseOrderStatusEnum,
      totalAmount: raw.totalAmount,
      idempotencyKey: raw.idempotencyKey ?? undefined,
      items: raw.items?.map((item) => ({
        id: item.id,
        purchaseOrderId: item.purchaseOrderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      })),
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapSupplierQuotation(raw: PrismaSupplierQuotation): SupplierQuotationEntity {
    return {
      id: raw.id,
      supplierId: raw.supplierId,
      productId: raw.productId,
      unitPrice: raw.unitPrice,
      validUntil: raw.validUntil ? raw.validUntil.toISOString() : undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapGoodsReceipt(raw: PrismaGoodsReceipt): GoodsReceiptEntity {
    return {
      id: raw.id,
      purchaseOrderId: raw.purchaseOrderId,
      receivedQuantity: raw.receivedQuantity,
      warehouseId: raw.warehouseId,
      receivedAt: raw.receivedAt.toISOString(),
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async createSupplier(supplier: SupplierEntity): Promise<SupplierEntity> {
    const created = await this.prisma.supplier.create({
      data: {
        id: supplier.id,
        name: supplier.name,
        contactEmail: supplier.contactEmail,
        contactPhone: supplier.contactPhone,
        isVerified: supplier.isVerified,
        createdAt: supplier.createdAt ? new Date(supplier.createdAt) : undefined,
        updatedAt: supplier.updatedAt ? new Date(supplier.updatedAt) : undefined
      }
    });
    return this.mapSupplier(created);
  }

  async findSupplierById(id: string): Promise<SupplierEntity | null> {
    const found = await this.prisma.supplier.findUnique({
      where: { id }
    });
    return found ? this.mapSupplier(found) : null;
  }

  async findAllSuppliers(): Promise<SupplierEntity[]> {
    const suppliers = await this.prisma.supplier.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return suppliers.map((s) => this.mapSupplier(s));
  }

  async createPurchaseRequest(request: PurchaseRequestEntity): Promise<PurchaseRequestEntity> {
    const created = await this.prisma.purchaseRequest.create({
      data: {
        id: request.id,
        requestedBy: request.requestedBy,
        productId: request.productId,
        quantity: request.quantity,
        status: request.status as PrismaPurchaseRequestStatus,
        reason: request.reason,
        createdAt: request.createdAt ? new Date(request.createdAt) : undefined,
        updatedAt: request.updatedAt ? new Date(request.updatedAt) : undefined
      }
    });
    return this.mapPurchaseRequest(created);
  }

  async findPurchaseRequestById(id: string): Promise<PurchaseRequestEntity | null> {
    const found = await this.prisma.purchaseRequest.findUnique({
      where: { id }
    });
    return found ? this.mapPurchaseRequest(found) : null;
  }

  async updatePurchaseRequestStatus(
    id: string,
    status: PurchaseRequestStatusEnum
  ): Promise<PurchaseRequestEntity> {
    const updated = await this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: status as PrismaPurchaseRequestStatus,
        updatedAt: new Date()
      }
    });
    return this.mapPurchaseRequest(updated);
  }

  async createPurchaseOrder(order: PurchaseOrderEntity): Promise<PurchaseOrderEntity> {
    const created = await this.prisma.purchaseOrder.create({
      data: {
        id: order.id,
        supplierId: order.supplierId,
        orderNumber: order.orderNumber,
        status: order.status as PrismaPurchaseOrderStatus,
        totalAmount: order.totalAmount,
        idempotencyKey: order.idempotencyKey,
        createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
        updatedAt: order.updatedAt ? new Date(order.updatedAt) : undefined,
        items: {
          create: (order.items || []).map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          }))
        }
      },
      include: {
        items: true
      }
    });
    return this.mapPurchaseOrder(created);
  }

  async findPurchaseOrderById(id: string): Promise<PurchaseOrderEntity | null> {
    const found = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });
    return found ? this.mapPurchaseOrder(found) : null;
  }

  async findPurchaseOrderByIdempotencyKey(key: string): Promise<PurchaseOrderEntity | null> {
    const found = await this.prisma.purchaseOrder.findFirst({
      where: { idempotencyKey: key },
      include: { items: true }
    });
    return found ? this.mapPurchaseOrder(found) : null;
  }

  async updatePurchaseOrderStatus(
    id: string,
    status: PurchaseOrderStatusEnum
  ): Promise<PurchaseOrderEntity> {
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: status as PrismaPurchaseOrderStatus,
        updatedAt: new Date()
      },
      include: {
        items: true
      }
    });
    return this.mapPurchaseOrder(updated);
  }

  async createSupplierQuotation(quotation: SupplierQuotationEntity): Promise<SupplierQuotationEntity> {
    const created = await this.prisma.supplierQuotation.create({
      data: {
        id: quotation.id,
        supplierId: quotation.supplierId,
        productId: quotation.productId,
        unitPrice: quotation.unitPrice,
        validUntil: quotation.validUntil ? new Date(quotation.validUntil) : undefined,
        createdAt: quotation.createdAt ? new Date(quotation.createdAt) : undefined,
        updatedAt: quotation.updatedAt ? new Date(quotation.updatedAt) : undefined
      }
    });
    return this.mapSupplierQuotation(created);
  }

  async findQuotationsByProduct(productId: string): Promise<SupplierQuotationEntity[]> {
    const quotations = await this.prisma.supplierQuotation.findMany({
      where: { productId },
      orderBy: { unitPrice: 'asc' }
    });
    return quotations.map((q) => this.mapSupplierQuotation(q));
  }

  async createGoodsReceipt(receipt: GoodsReceiptEntity): Promise<GoodsReceiptEntity> {
    const created = await this.prisma.goodsReceipt.create({
      data: {
        id: receipt.id,
        purchaseOrderId: receipt.purchaseOrderId,
        receivedQuantity: receipt.receivedQuantity,
        warehouseId: receipt.warehouseId,
        receivedAt: receipt.receivedAt ? new Date(receipt.receivedAt) : undefined,
        createdAt: receipt.createdAt ? new Date(receipt.createdAt) : undefined,
        updatedAt: receipt.updatedAt ? new Date(receipt.updatedAt) : undefined
      }
    });
    return this.mapGoodsReceipt(created);
  }

  async findGoodsReceiptsByPurchaseOrder(purchaseOrderId: string): Promise<GoodsReceiptEntity[]> {
    const receipts = await this.prisma.goodsReceipt.findMany({
      where: { purchaseOrderId },
      orderBy: { receivedAt: 'desc' }
    });
    return receipts.map((r) => this.mapGoodsReceipt(r));
  }
}
