import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import type {
  Supplier,
  PurchaseRequest,
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierQuotation,
  GoodsReceipt
} from './domain/procurement.types';
import {
  PROCUREMENT_REPOSITORY,
  type IProcurementRepository
} from './domain/procurement.repository.interface';
import type { CreateSupplierDto } from './dto/create-supplier.dto';
import type { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import type { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import type { CreateSupplierQuotationDto } from './dto/create-supplier-quotation.dto';
import type { RecordGoodsReceiptDto } from './dto/record-goods-receipt.dto';

@Injectable()
export class ProcurementService {
  constructor(
    @Inject(PROCUREMENT_REPOSITORY)
    private readonly repository: IProcurementRepository
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async createSupplier(dto: CreateSupplierDto): Promise<ApiResponse<Supplier>> {
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Supplier name is required');
    }

    const existing = await this.repository.findSupplierByName(dto.name.trim());
    if (existing) {
      throw new BadRequestException(`Supplier with name "${dto.name}" already exists`);
    }

    const supplier: Supplier = {
      id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: dto.name.trim(),
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      isVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.createSupplier(supplier);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async verifySupplier(id: string): Promise<ApiResponse<Supplier>> {
    const supplier = await this.repository.findSupplierById(id);
    if (!supplier) {
      throw new NotFoundException(`Supplier [${id}] not found`);
    }

    supplier.isVerified = true;
    supplier.updatedAt = new Date().toISOString();
    const updated = await this.repository.updateSupplier(supplier);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async getSupplier(id: string): Promise<ApiResponse<Supplier>> {
    const supplier = await this.repository.findSupplierById(id);
    if (!supplier) {
      throw new NotFoundException(`Supplier [${id}] not found`);
    }
    return {
      success: true,
      data: supplier,
      metadata: this.buildMetadata()
    };
  }

  async listSuppliers(): Promise<ApiResponse<Supplier[]>> {
    const suppliers = await this.repository.findAllSuppliers();
    return {
      success: true,
      data: suppliers,
      metadata: this.buildMetadata()
    };
  }

  async createPurchaseRequest(dto: CreatePurchaseRequestDto): Promise<ApiResponse<PurchaseRequest>> {
    if (!dto.productId || !dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Product ID and positive quantity are required');
    }

    const request: PurchaseRequest = {
      id: `pr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      requestedBy: dto.requestedBy || 'system',
      productId: dto.productId,
      quantity: dto.quantity,
      status: 'PENDING',
      reason: dto.reason,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.createPurchaseRequest(request);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async approvePurchaseRequest(id: string): Promise<ApiResponse<PurchaseRequest>> {
    const request = await this.repository.findPurchaseRequestById(id);
    if (!request) {
      throw new NotFoundException(`PurchaseRequest [${id}] not found`);
    }

    request.status = 'APPROVED';
    request.updatedAt = new Date().toISOString();
    const updated = await this.repository.updatePurchaseRequest(request);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async rejectPurchaseRequest(id: string): Promise<ApiResponse<PurchaseRequest>> {
    const request = await this.repository.findPurchaseRequestById(id);
    if (!request) {
      throw new NotFoundException(`PurchaseRequest [${id}] not found`);
    }

    request.status = 'REJECTED';
    request.updatedAt = new Date().toISOString();
    const updated = await this.repository.updatePurchaseRequest(request);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async getPurchaseRequest(id: string): Promise<ApiResponse<PurchaseRequest>> {
    const request = await this.repository.findPurchaseRequestById(id);
    if (!request) {
      throw new NotFoundException(`PurchaseRequest [${id}] not found`);
    }
    return {
      success: true,
      data: request,
      metadata: this.buildMetadata()
    };
  }

  async listPurchaseRequests(): Promise<ApiResponse<PurchaseRequest[]>> {
    const requests = await this.repository.findAllPurchaseRequests();
    return {
      success: true,
      data: requests,
      metadata: this.buildMetadata()
    };
  }

  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    idempotencyHeader?: string
  ): Promise<ApiResponse<PurchaseOrder>> {
    const idempotencyKey = dto.idempotencyKey || idempotencyHeader;

    if (idempotencyKey) {
      const existing = await this.repository.findPurchaseOrderByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          success: true,
          data: existing,
          metadata: this.buildMetadata()
        };
      }
    }

    if (!dto.supplierId) {
      throw new BadRequestException('Supplier ID is required');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required in a purchase order');
    }

    const supplier = await this.repository.findSupplierById(dto.supplierId);
    if (!supplier) {
      throw new NotFoundException(`Supplier [${dto.supplierId}] not found`);
    }

    if (!supplier.isVerified) {
      throw new BadRequestException('Supplier is not verified');
    }

    let purchaseRequest: PurchaseRequest | null = null;
    if (dto.purchaseRequestId) {
      purchaseRequest = await this.repository.findPurchaseRequestById(dto.purchaseRequestId);
      if (!purchaseRequest) {
        throw new NotFoundException(`PurchaseRequest [${dto.purchaseRequestId}] not found`);
      }
      if (purchaseRequest.status !== 'APPROVED') {
        throw new BadRequestException(
          `Cannot create Purchase Order from Purchase Request with status [${purchaseRequest.status}]. Must be APPROVED.`
        );
      }
    }

    const orderId = `po-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let totalAmount = 0;

    const items: PurchaseOrderItem[] = dto.items.map((item) => {
      if (!item.productId || !item.quantity || item.quantity <= 0 || item.unitPrice === undefined || item.unitPrice < 0) {
        throw new BadRequestException('Item must have valid productId, positive quantity, and non-negative unitPrice');
      }
      const itemTotal = Number((item.quantity * item.unitPrice).toFixed(2));
      totalAmount += itemTotal;
      return {
        id: `poi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        purchaseOrderId: orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: itemTotal
      };
    });

    const order: PurchaseOrder = {
      id: orderId,
      supplierId: dto.supplierId,
      purchaseRequestId: dto.purchaseRequestId,
      orderNumber: `PO-${Date.now().toString().slice(-6)}`,
      status: 'DRAFT',
      totalAmount: Number(totalAmount.toFixed(2)),
      idempotencyKey,
      items,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.createPurchaseOrder(order);

    if (purchaseRequest) {
      purchaseRequest.status = 'CONVERTED';
      purchaseRequest.updatedAt = new Date().toISOString();
      await this.repository.updatePurchaseRequest(purchaseRequest);
    }

    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async approvePurchaseOrder(id: string): Promise<ApiResponse<PurchaseOrder>> {
    const order = await this.repository.findPurchaseOrderById(id);
    if (!order) {
      throw new NotFoundException(`PurchaseOrder [${id}] not found`);
    }

    order.status = 'APPROVED';
    order.updatedAt = new Date().toISOString();
    const updated = await this.repository.updatePurchaseOrder(order);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async revertPurchaseOrderToDraft(id: string): Promise<ApiResponse<PurchaseOrder>> {
    const order = await this.repository.findPurchaseOrderById(id);
    if (!order) {
      throw new NotFoundException(`PurchaseOrder [${id}] not found`);
    }

    order.status = 'DRAFT';
    order.updatedAt = new Date().toISOString();
    const updated = await this.repository.updatePurchaseOrder(order);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async receiveGoods(dto: RecordGoodsReceiptDto): Promise<ApiResponse<GoodsReceipt>> {
    if (!dto.purchaseOrderId || !dto.warehouseId || !dto.receivedQuantity || dto.receivedQuantity <= 0) {
      throw new BadRequestException('PurchaseOrder ID, Warehouse ID, and positive receivedQuantity are required');
    }

    const order = await this.repository.findPurchaseOrderById(dto.purchaseOrderId);
    if (!order) {
      throw new NotFoundException(`PurchaseOrder [${dto.purchaseOrderId}] not found`);
    }

    const receipt: GoodsReceipt = {
      id: `gr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      purchaseOrderId: dto.purchaseOrderId,
      receivedQuantity: dto.receivedQuantity,
      warehouseId: dto.warehouseId,
      receivedAt: dto.receivedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const savedReceipt = await this.repository.createGoodsReceipt(receipt);

    const allReceipts = await this.repository.findGoodsReceiptsByPurchaseOrderId(dto.purchaseOrderId);
    const totalReceivedQuantity = allReceipts.reduce((sum, r) => sum + r.receivedQuantity, 0);
    const totalOrderQuantity = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);

    if (totalOrderQuantity > 0 && totalReceivedQuantity >= totalOrderQuantity) {
      order.status = 'RECEIVED';
      order.updatedAt = new Date().toISOString();
      await this.repository.updatePurchaseOrder(order);
    }

    return {
      success: true,
      data: savedReceipt,
      metadata: this.buildMetadata()
    };
  }

  async getPurchaseOrder(id: string): Promise<ApiResponse<PurchaseOrder>> {
    const order = await this.repository.findPurchaseOrderById(id);
    if (!order) {
      throw new NotFoundException(`PurchaseOrder [${id}] not found`);
    }
    return {
      success: true,
      data: order,
      metadata: this.buildMetadata()
    };
  }

  async listPurchaseOrders(): Promise<ApiResponse<PurchaseOrder[]>> {
    const orders = await this.repository.findAllPurchaseOrders();
    return {
      success: true,
      data: orders,
      metadata: this.buildMetadata()
    };
  }

  async createSupplierQuotation(dto: CreateSupplierQuotationDto): Promise<ApiResponse<SupplierQuotation>> {
    if (!dto.supplierId || !dto.productId || dto.unitPrice === undefined || dto.unitPrice < 0) {
      throw new BadRequestException('Supplier ID, Product ID, and non-negative unitPrice are required');
    }

    const quotation: SupplierQuotation = {
      id: `sq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      supplierId: dto.supplierId,
      productId: dto.productId,
      unitPrice: dto.unitPrice,
      validUntil: dto.validUntil,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.createSupplierQuotation(quotation);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async listSupplierQuotations(productId?: string, supplierId?: string): Promise<ApiResponse<SupplierQuotation[]>> {
    const quotations = await this.repository.findSupplierQuotations(productId, supplierId);
    return {
      success: true,
      data: quotations,
      metadata: this.buildMetadata()
    };
  }
}
