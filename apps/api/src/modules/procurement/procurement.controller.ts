import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { ProcurementService } from './procurement.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { CreateSupplierQuotationDto } from './dto/create-supplier-quotation.dto';
import { RecordGoodsReceiptDto } from './dto/record-goods-receipt.dto';

@Controller('api/v1/procurement')
export class ProcurementController {
  constructor(
    @Inject(ProcurementService)
    private readonly procurementService: ProcurementService
  ) {}

  @Post('suppliers')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('procurement:write')
  @Audit('CREATE_SUPPLIER')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.procurementService.createSupplier(dto);
  }

  @Patch('suppliers/:id/verify')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('procurement:write')
  @Audit('VERIFY_SUPPLIER')
  verifySupplier(@Param('id') id: string) {
    return this.procurementService.verifySupplier(id);
  }

  @Get('suppliers')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('procurement:read')
  @Audit('LIST_SUPPLIERS')
  listSuppliers() {
    return this.procurementService.listSuppliers();
  }

  @Get('suppliers/:id')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('procurement:read')
  @Audit('GET_SUPPLIER')
  getSupplier(@Param('id') id: string) {
    return this.procurementService.getSupplier(id);
  }

  @Post('purchase-requests')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('procurement:write')
  @Audit('CREATE_PURCHASE_REQUEST')
  createPurchaseRequest(@Body() dto: CreatePurchaseRequestDto) {
    return this.procurementService.createPurchaseRequest(dto);
  }

  @Patch('purchase-requests/:id/approve')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('procurement:approve')
  @Audit('APPROVE_PURCHASE_REQUEST')
  approvePurchaseRequest(@Param('id') id: string) {
    return this.procurementService.approvePurchaseRequest(id);
  }

  @Patch('purchase-requests/:id/reject')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('procurement:approve')
  @Audit('REJECT_PURCHASE_REQUEST')
  rejectPurchaseRequest(@Param('id') id: string) {
    return this.procurementService.rejectPurchaseRequest(id);
  }

  @Get('purchase-requests')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('procurement:read')
  @Audit('LIST_PURCHASE_REQUESTS')
  listPurchaseRequests() {
    return this.procurementService.listPurchaseRequests();
  }

  @Get('purchase-requests/:id')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('procurement:read')
  @Audit('GET_PURCHASE_REQUEST')
  getPurchaseRequest(@Param('id') id: string) {
    return this.procurementService.getPurchaseRequest(id);
  }

  @Post('purchase-orders')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('procurement:write')
  @Audit('CREATE_PURCHASE_ORDER')
  createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @Headers('idempotency-key') idempotencyHeader?: string
  ) {
    return this.procurementService.createPurchaseOrder(dto, idempotencyHeader);
  }

  @Patch('purchase-orders/:id/approve')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('procurement:approve')
  @Audit('APPROVE_PURCHASE_ORDER')
  approvePurchaseOrder(@Param('id') id: string) {
    return this.procurementService.approvePurchaseOrder(id);
  }

  @Post('goods-receipts')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('procurement:write')
  @Audit('RECORD_GOODS_RECEIPT')
  receiveGoods(@Body() dto: RecordGoodsReceiptDto) {
    return this.procurementService.receiveGoods(dto);
  }

  @Get('purchase-orders')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('procurement:read')
  @Audit('LIST_PURCHASE_ORDERS')
  listPurchaseOrders() {
    return this.procurementService.listPurchaseOrders();
  }

  @Get('purchase-orders/:id')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('procurement:read')
  @Audit('GET_PURCHASE_ORDER')
  getPurchaseOrder(@Param('id') id: string) {
    return this.procurementService.getPurchaseOrder(id);
  }

  @Post('quotations')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('procurement:write')
  @Audit('CREATE_SUPPLIER_QUOTATION')
  createSupplierQuotation(@Body() dto: CreateSupplierQuotationDto) {
    return this.procurementService.createSupplierQuotation(dto);
  }

  @Get('quotations')
  @Roles(Role.TENANT_ADMIN, Role.PROCUREMENT_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('procurement:read')
  @Audit('LIST_SUPPLIER_QUOTATIONS')
  listSupplierQuotations(
    @Query('productId') productId?: string,
    @Query('supplierId') supplierId?: string
  ) {
    return this.procurementService.listSupplierQuotations(productId, supplierId);
  }
}
