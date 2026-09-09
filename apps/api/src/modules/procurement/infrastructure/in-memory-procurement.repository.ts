import { Injectable } from '@nestjs/common';
import type {
  Supplier,
  PurchaseRequest,
  PurchaseOrder,
  SupplierQuotation,
  GoodsReceipt
} from '../domain/procurement.types';
import type { IProcurementRepository } from '../domain/procurement.repository.interface';

@Injectable()
export class InMemoryProcurementRepository implements IProcurementRepository {
  private readonly suppliers: Map<string, Supplier> = new Map();
  private readonly purchaseRequests: Map<string, PurchaseRequest> = new Map();
  private readonly purchaseOrders: Map<string, PurchaseOrder> = new Map();
  private readonly supplierQuotations: Map<string, SupplierQuotation> = new Map();
  private readonly goodsReceipts: Map<string, GoodsReceipt> = new Map();

  async createSupplier(supplier: Supplier): Promise<Supplier> {
    this.suppliers.set(supplier.id, { ...supplier });
    return { ...supplier };
  }

  async findSupplierById(id: string): Promise<Supplier | null> {
    const item = this.suppliers.get(id);
    if (!item) {
      return null;
    }
    return { ...item };
  }

  async findSupplierByName(name: string): Promise<Supplier | null> {
    for (const item of this.suppliers.values()) {
      if (item.name === name) {
        return { ...item };
      }
    }
    return null;
  }

  async findAllSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values()).map((item) => ({ ...item }));
  }

  async updateSupplier(supplier: Supplier): Promise<Supplier> {
    if (!this.suppliers.has(supplier.id)) {
      throw new Error(`Supplier [${supplier.id}] not found`);
    }
    this.suppliers.set(supplier.id, { ...supplier });
    return { ...supplier };
  }

  async createPurchaseRequest(request: PurchaseRequest): Promise<PurchaseRequest> {
    this.purchaseRequests.set(request.id, { ...request });
    return { ...request };
  }

  async findPurchaseRequestById(id: string): Promise<PurchaseRequest | null> {
    const item = this.purchaseRequests.get(id);
    if (!item) {
      return null;
    }
    return { ...item };
  }

  async findAllPurchaseRequests(): Promise<PurchaseRequest[]> {
    return Array.from(this.purchaseRequests.values()).map((item) => ({ ...item }));
  }

  async updatePurchaseRequest(request: PurchaseRequest): Promise<PurchaseRequest> {
    if (!this.purchaseRequests.has(request.id)) {
      throw new Error(`PurchaseRequest [${request.id}] not found`);
    }
    this.purchaseRequests.set(request.id, { ...request });
    return { ...request };
  }

  async createPurchaseOrder(order: PurchaseOrder): Promise<PurchaseOrder> {
    this.purchaseOrders.set(order.id, {
      ...order,
      items: order.items ? [...order.items] : []
    });
    return {
      ...order,
      items: order.items ? [...order.items] : []
    };
  }

  async findPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
    const item = this.purchaseOrders.get(id);
    if (!item) {
      return null;
    }
    return {
      ...item,
      items: item.items ? [...item.items] : []
    };
  }

  async findPurchaseOrderByIdempotencyKey(
    idempotencyKey: string
  ): Promise<PurchaseOrder | null> {
    for (const item of this.purchaseOrders.values()) {
      if (item.idempotencyKey === idempotencyKey) {
        return {
          ...item,
          items: item.items ? [...item.items] : []
        };
      }
    }
    return null;
  }

  async findAllPurchaseOrders(): Promise<PurchaseOrder[]> {
    return Array.from(this.purchaseOrders.values()).map((item) => ({
      ...item,
      items: item.items ? [...item.items] : []
    }));
  }

  async updatePurchaseOrder(order: PurchaseOrder): Promise<PurchaseOrder> {
    if (!this.purchaseOrders.has(order.id)) {
      throw new Error(`PurchaseOrder [${order.id}] not found`);
    }
    this.purchaseOrders.set(order.id, {
      ...order,
      items: order.items ? [...order.items] : []
    });
    return {
      ...order,
      items: order.items ? [...order.items] : []
    };
  }

  async createSupplierQuotation(quotation: SupplierQuotation): Promise<SupplierQuotation> {
    this.supplierQuotations.set(quotation.id, { ...quotation });
    return { ...quotation };
  }

  async findSupplierQuotations(
    productId?: string,
    supplierId?: string
  ): Promise<SupplierQuotation[]> {
    return Array.from(this.supplierQuotations.values())
      .filter((q) => (productId ? q.productId === productId : true))
      .filter((q) => (supplierId ? q.supplierId === supplierId : true))
      .map((item) => ({ ...item }));
  }

  async createGoodsReceipt(receipt: GoodsReceipt): Promise<GoodsReceipt> {
    this.goodsReceipts.set(receipt.id, { ...receipt });
    return { ...receipt };
  }

  async findGoodsReceiptsByPurchaseOrderId(
    purchaseOrderId: string
  ): Promise<GoodsReceipt[]> {
    return Array.from(this.goodsReceipts.values())
      .filter((r) => r.purchaseOrderId === purchaseOrderId)
      .map((item) => ({ ...item }));
  }

  async findAllGoodsReceipts(): Promise<GoodsReceipt[]> {
    return Array.from(this.goodsReceipts.values()).map((item) => ({ ...item }));
  }
}
