import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  Customer,
  SalesOrder,
  SalesOrderItem,
  SalesOrderStatus,
  SalesChannel,
  SalesRep,
  SalesRepKpi,
  LeadOutcome,
  ApiResponse
} from '@autonomous-enterprise/contracts';
import { CUSTOMER_REPOSITORY, ICustomerRepository } from './domain/customer.repository.interface';
import { SALES_ORDER_REPOSITORY, ISalesOrderRepository } from './domain/sales-order.repository.interface';
import { SALES_REP_REPOSITORY, ISalesRepRepository } from './domain/sales-rep.repository.interface';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { CreateSalesRepDto, CloseLeadDto } from './dto/sales-rep.dto';

@Injectable()
export class SalesService {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: ICustomerRepository,
    @Inject(SALES_ORDER_REPOSITORY) private readonly salesOrderRepository: ISalesOrderRepository,
    @Inject(SALES_REP_REPOSITORY) private readonly salesRepRepository: ISalesRepRepository
  ) {}

  async createCustomer(dto: CreateCustomerDto): Promise<ApiResponse<Customer>> {
    if (!dto.name || !dto.email) {
      throw new BadRequestException('Customer name and email are required');
    }
    const customer: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await this.customerRepository.create(customer);
    return {
      success: true,
      data: saved,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  async getCustomer(id: string): Promise<ApiResponse<Customer>> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer [${id}] not found`);
    }
    return {
      success: true,
      data: customer,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  async listCustomers(): Promise<ApiResponse<Customer[]>> {
    const customers = await this.customerRepository.findAll();
    return {
      success: true,
      data: customers,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  async createSalesOrder(dto: CreateSalesOrderDto, headerIdempotencyKey?: string): Promise<ApiResponse<SalesOrder>> {
    const idempotencyKey = headerIdempotencyKey || dto.idempotencyKey;
    if (idempotencyKey) {
      const existing = await this.salesOrderRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          success: true,
          data: existing,
          metadata: {
            timestamp: new Date().toISOString()
          }
        };
      }
    }

    if (!dto.customerId) {
      throw new BadRequestException('Customer ID is required');
    }
    const customer = await this.customerRepository.findById(dto.customerId);
    if (!customer) {
      throw new NotFoundException(`Customer [${dto.customerId}] not found`);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Sales order must contain at least one item');
    }

    let subtotal = 0;
    let itemDiscountsTotal = 0;
    const items: SalesOrderItem[] = [];

    for (const itemDto of dto.items) {
      if (!itemDto.productId) {
        throw new BadRequestException('Product ID is required for all items');
      }
      if (itemDto.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than zero');
      }
      if (itemDto.unitPrice < 0) {
        throw new BadRequestException('Unit price cannot be negative');
      }
      const itemDiscount = itemDto.discount || 0;
      if (itemDiscount < 0) {
        throw new BadRequestException('Item discount cannot be negative');
      }
      const grossItemTotal = itemDto.unitPrice * itemDto.quantity;
      if (itemDiscount > grossItemTotal) {
        throw new BadRequestException('Item discount cannot exceed gross item total');
      }

      const itemTotalPrice = grossItemTotal - itemDiscount;
      subtotal += grossItemTotal;
      itemDiscountsTotal += itemDiscount;

      items.push({
        id: `soi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: itemDto.productId,
        quantity: itemDto.quantity,
        unitPrice: itemDto.unitPrice,
        discount: itemDiscount,
        totalPrice: itemTotalPrice
      });
    }

    const orderDiscount = dto.discountAmount || 0;
    if (orderDiscount < 0) {
      throw new BadRequestException('Order discount amount cannot be negative');
    }
    const totalDiscount = itemDiscountsTotal + orderDiscount;
    if (totalDiscount > subtotal) {
      throw new BadRequestException('Total discount cannot exceed subtotal');
    }

    const totalAmount = subtotal - totalDiscount;

    const channel = dto.channel ?? SalesChannel.DIRECT_SALES;
    const isMarketplace = channel === SalesChannel.MARKETPLACE;
    const status = isMarketplace ? SalesOrderStatus.APPROVED : SalesOrderStatus.DRAFT;
    const prefix = isMarketplace ? 'MP' : 'DS';

    let assignedRepId = dto.assignedRepId;
    if (!isMarketplace && !assignedRepId) {
      const allReps = await this.salesRepRepository.findAll();
      const activeReps = allReps.filter((r) => r.active);
      if (activeReps.length > 0) {
        const picked = activeReps[Math.floor(Math.random() * activeReps.length)];
        assignedRepId = picked.id;
      }
    }

    const now = new Date().toISOString();
    const order: SalesOrder = {
      id: `so-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      customerId: dto.customerId,
      orderNumber: `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`,
      items,
      subtotal,
      discountAmount: totalDiscount,
      totalAmount,
      status,
      channel,
      assignedRepId: !isMarketplace ? assignedRepId : undefined,
      assignedAt: !isMarketplace && assignedRepId ? now : undefined,
      leadOutcome: !isMarketplace ? LeadOutcome.PENDING : undefined,
      idempotencyKey,
      notes: dto.notes,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.salesOrderRepository.create(order);
    return {
      success: true,
      data: saved,
      metadata: {
        timestamp: now
      }
    };
  }

  async getSalesOrder(id: string): Promise<ApiResponse<SalesOrder>> {
    const order = await this.salesOrderRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Sales order [${id}] not found`);
    }
    return {
      success: true,
      data: order,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  async listSalesOrders(): Promise<ApiResponse<SalesOrder[]>> {
    const orders = await this.salesOrderRepository.findAll();
    return {
      success: true,
      data: orders,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  async updateOrderStatus(id: string, newStatus: SalesOrderStatus): Promise<ApiResponse<SalesOrder>> {
    const order = await this.salesOrderRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Sales order [${id}] not found`);
    }

    const validTransitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
      [SalesOrderStatus.DRAFT]: [SalesOrderStatus.PENDING_APPROVAL, SalesOrderStatus.APPROVED, SalesOrderStatus.CANCELLED],
      [SalesOrderStatus.PENDING_APPROVAL]: [SalesOrderStatus.APPROVED, SalesOrderStatus.REJECTED, SalesOrderStatus.CANCELLED],
      [SalesOrderStatus.APPROVED]: [SalesOrderStatus.FULFILLED, SalesOrderStatus.CANCELLED],
      [SalesOrderStatus.REJECTED]: [],
      [SalesOrderStatus.CANCELLED]: [],
      [SalesOrderStatus.FULFILLED]: []
    };

    if (!validTransitions[order.status].includes(newStatus)) {
      throw new BadRequestException(`Invalid state transition from ${order.status} to ${newStatus}`);
    }

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();

    const updated = await this.salesOrderRepository.update(order);
    return {
      success: true,
      data: updated,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  async createSalesRep(dto: CreateSalesRepDto): Promise<ApiResponse<SalesRep>> {
    if (!dto.fullName || !dto.email) {
      throw new BadRequestException('Sales rep fullName and email are required');
    }

    const now = new Date().toISOString();
    const rep: SalesRep = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      employeeId: dto.employeeId,
      fullName: dto.fullName,
      email: dto.email,
      territory: dto.territory,
      quotaMonthlyUsd: dto.quotaMonthlyUsd ?? 10000,
      active: true,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.salesRepRepository.create(rep);
    return { success: true, data: saved, metadata: { timestamp: now } };
  }

  async listSalesReps(): Promise<ApiResponse<SalesRep[]>> {
    const reps = await this.salesRepRepository.findAll();
    return {
      success: true,
      data: reps,
      metadata: { timestamp: new Date().toISOString() }
    };
  }

  async assignLead(orderId: string, repId: string): Promise<ApiResponse<SalesOrder>> {
    const order = await this.salesOrderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Sales order [${orderId}] not found`);
    }
    if (order.channel === SalesChannel.MARKETPLACE) {
      throw new BadRequestException('Marketplace orders are self-service and cannot be assigned to a sales rep');
    }
    if (order.leadOutcome && order.leadOutcome !== LeadOutcome.PENDING) {
      throw new BadRequestException(`Lead is already closed as ${order.leadOutcome}`);
    }

    const rep = await this.salesRepRepository.findById(repId);
    if (!rep) {
      throw new NotFoundException(`Sales rep [${repId}] not found`);
    }
    if (!rep.active) {
      throw new BadRequestException(`Sales rep [${rep.fullName}] is not active`);
    }

    const now = new Date().toISOString();
    order.assignedRepId = repId;
    order.assignedAt = now;
    order.leadOutcome = LeadOutcome.PENDING;
    order.updatedAt = now;

    const updated = await this.salesOrderRepository.update(order);
    return { success: true, data: updated, metadata: { timestamp: now } };
  }

  async closeLead(orderId: string, dto: CloseLeadDto): Promise<ApiResponse<SalesOrder>> {
    const order = await this.salesOrderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Sales order [${orderId}] not found`);
    }
    if (order.channel === SalesChannel.MARKETPLACE) {
      throw new BadRequestException('Marketplace orders do not require sales closing');
    }
    if (!order.assignedRepId) {
      throw new BadRequestException('Cannot close unassigned lead');
    }
    if (order.leadOutcome && order.leadOutcome !== LeadOutcome.PENDING) {
      throw new BadRequestException(`Lead is already closed as ${order.leadOutcome}`);
    }

    const outcome = String(dto.outcome).toUpperCase() as LeadOutcome;
    if (outcome !== LeadOutcome.WON && outcome !== LeadOutcome.LOST) {
      throw new BadRequestException('outcome must be WON or LOST');
    }
    if (outcome === LeadOutcome.LOST && !dto.lostReason) {
      throw new BadRequestException('lostReason is required when closing as LOST');
    }

    const now = new Date().toISOString();
    order.leadOutcome = outcome;
    order.closedAt = now;
    order.lostReason = dto.lostReason;
    order.status = outcome === LeadOutcome.WON ? SalesOrderStatus.APPROVED : SalesOrderStatus.CANCELLED;
    order.updatedAt = now;

    const updated = await this.salesOrderRepository.update(order);
    return { success: true, data: updated, metadata: { timestamp: now } };
  }

  async getSalesRepKpis(): Promise<ApiResponse<SalesRepKpi[]>> {
    const [reps, orders] = await Promise.all([
      this.salesRepRepository.findAll(),
      this.salesOrderRepository.findAll()
    ]);

    const kpis: SalesRepKpi[] = reps.map((rep) => {
      const assigned = orders.filter((o) => o.assignedRepId === rep.id);
      const won = assigned.filter((o) => o.leadOutcome === LeadOutcome.WON);
      const lost = assigned.filter((o) => o.leadOutcome === LeadOutcome.LOST);
      const pending = assigned.filter((o) => !o.leadOutcome || o.leadOutcome === LeadOutcome.PENDING);
      const decided = won.length + lost.length;

      const closingRate = decided > 0 ? won.length / decided : 0;
      const revenueClosedUsd = won.reduce((sum, o) => sum + o.totalAmount, 0);
      const quotaAttainment = rep.quotaMonthlyUsd > 0 ? revenueClosedUsd / rep.quotaMonthlyUsd : 0;

      const closedWithTimes = won
        .filter((o) => o.assignedAt && o.closedAt)
        .map((o) => (new Date(o.closedAt!).getTime() - new Date(o.assignedAt!).getTime()) / 60000);

      const avgClosingTimeMinutes =
        closedWithTimes.length > 0
          ? closedWithTimes.reduce((a, b) => a + b, 0) / closedWithTimes.length
          : 0;

      const rateScore = closingRate * 50;
      const quotaScore = Math.min(1, quotaAttainment) * 35;
      const speedScore = avgClosingTimeMinutes > 0 ? Math.max(0, 15 - avgClosingTimeMinutes * 0.5) : 0;
      const kpiScore = Number((rateScore + quotaScore + speedScore).toFixed(1));

      const rating: SalesRepKpi['rating'] =
        kpiScore >= 75 ? 'A' : kpiScore >= 50 ? 'B' : kpiScore >= 25 ? 'C' : 'D';

      return {
        repId: rep.id,
        fullName: rep.fullName,
        territory: rep.territory,
        assignedLeads: assigned.length,
        wonDeals: won.length,
        lostDeals: lost.length,
        pendingLeads: pending.length,
        closingRate: Number(closingRate.toFixed(4)),
        revenueClosedUsd: Number(revenueClosedUsd.toFixed(2)),
        quotaMonthlyUsd: rep.quotaMonthlyUsd,
        quotaAttainment: Number(quotaAttainment.toFixed(4)),
        avgClosingTimeMinutes: Number(avgClosingTimeMinutes.toFixed(2)),
        kpiScore,
        rating
      };
    });

    kpis.sort((a, b) => b.kpiScore - a.kpiScore);

    return {
      success: true,
      data: kpis,
      metadata: { timestamp: new Date().toISOString() }
    };
  }

  async getChannelSummary(): Promise<ApiResponse<Record<string, unknown>>> {
    const orders = await this.salesOrderRepository.findAll();

    const marketplace = orders.filter((o) => o.channel === SalesChannel.MARKETPLACE);
    const direct = orders.filter((o) => o.channel === SalesChannel.DIRECT_SALES);
    const directWon = direct.filter((o) => o.leadOutcome === LeadOutcome.WON);
    const directLost = direct.filter((o) => o.leadOutcome === LeadOutcome.LOST);
    const directPending = direct.filter((o) => !o.leadOutcome || o.leadOutcome === LeadOutcome.PENDING);
    const decided = directWon.length + directLost.length;

    const sum = (list: SalesOrder[]) => Number(list.reduce((s, o) => s + o.totalAmount, 0).toFixed(2));

    const marketplaceRevenue = sum(marketplace.filter((o) => o.status === SalesOrderStatus.APPROVED || o.status === SalesOrderStatus.FULFILLED));
    const directRevenue = sum(directWon);
    const totalRevenue = Number((marketplaceRevenue + directRevenue).toFixed(2));

    return {
      success: true,
      data: {
        totalOrders: orders.length,
        totalRevenueUsd: totalRevenue,
        marketplace: {
          count: marketplace.length,
          revenueUsd: marketplaceRevenue,
          revenueShare: totalRevenue > 0 ? Number((marketplaceRevenue / totalRevenue).toFixed(4)) : 0
        },
        directSales: {
          count: direct.length,
          wonCount: directWon.length,
          lostCount: directLost.length,
          pendingCount: directPending.length,
          closingRate: decided > 0 ? Number((directWon.length / decided).toFixed(4)) : 0,
          revenueUsd: directRevenue,
          revenueShare: totalRevenue > 0 ? Number((directRevenue / totalRevenue).toFixed(4)) : 0
        }
      },
      metadata: { timestamp: new Date().toISOString() }
    };
  }
}
