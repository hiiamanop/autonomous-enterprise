import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query
} from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { SetStockDto } from './dto/set-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { CreateReorderRuleDto } from './dto/create-reorder-rule.dto';

@Controller('api/v1/inventory')
export class InventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService
  ) {}

  @Post('products')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('inventory:write')
  @Audit('CREATE_PRODUCT')
  createProduct(@Body() dto: CreateProductDto) {
    return this.inventoryService.createProduct(dto);
  }

  @Get('products')
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('inventory:read')
  @Audit('LIST_PRODUCTS')
  listProducts() {
    return this.inventoryService.listProducts();
  }

  @Get('products/:id')
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('inventory:read')
  @Audit('GET_PRODUCT')
  getProduct(@Param('id') id: string) {
    return this.inventoryService.getProduct(id);
  }

  @Post('warehouses')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER)
  @RequirePermissions('inventory:write')
  @Audit('CREATE_WAREHOUSE')
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(dto);
  }

  @Get('warehouses')
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('inventory:read')
  @Audit('LIST_WAREHOUSES')
  listWarehouses() {
    return this.inventoryService.listWarehouses();
  }

  @Post('stock')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('inventory:write')
  @Audit('SET_STOCK')
  setStock(@Body() dto: SetStockDto) {
    return this.inventoryService.setStock(dto);
  }

  @Get('stock/availability')
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('inventory:read')
  @Audit('CHECK_STOCK_AVAILABILITY')
  checkAvailability(
    @Query('warehouseId') warehouseId: string,
    @Query('productId') productId: string,
    @Query('quantity') quantity?: string
  ) {
    const qty = quantity ? parseInt(quantity, 10) : 1;
    return this.inventoryService.checkAvailability(warehouseId, productId, qty);
  }

  @Post('reservations')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('inventory:write')
  @Audit('CREATE_STOCK_RESERVATION')
  reserveStock(@Body() dto: ReserveStockDto) {
    return this.inventoryService.reserveStock(dto);
  }

  @Post('reservations/:id/cancel')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('inventory:write')
  @Audit('CANCEL_STOCK_RESERVATION')
  cancelReservation(@Param('id') id: string) {
    return this.inventoryService.cancelReservation(id);
  }

  @Get('reservations')
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('inventory:read')
  @Audit('LIST_STOCK_RESERVATIONS')
  listReservations() {
    return this.inventoryService.listReservations();
  }

  @Post('reorder-rules')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER)
  @RequirePermissions('inventory:write')
  @Audit('CREATE_REORDER_RULE')
  createReorderRule(@Body() dto: CreateReorderRuleDto) {
    return this.inventoryService.createReorderRule(dto);
  }

  @Get('reorder-rules')
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('inventory:read')
  @Audit('LIST_REORDER_RULES')
  listReorderRules(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string
  ) {
    return this.inventoryService.listReorderRules(warehouseId, productId);
  }

  @Get('movements')
  @Roles(Role.TENANT_ADMIN, Role.INVENTORY_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('inventory:read')
  @Audit('LIST_STOCK_MOVEMENTS')
  listMovements(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string
  ) {
    return this.inventoryService.listMovements(warehouseId, productId);
  }
}
