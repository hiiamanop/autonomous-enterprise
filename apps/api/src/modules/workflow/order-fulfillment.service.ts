import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  ApiResponse,
  SalesOrderStatus,
  WorkflowExecutionResult,
  WorkflowReservationDetail,
  WorkflowStatus
} from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { SalesService } from '../sales/sales.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../../common/audit/audit.service';
import { OutboxService } from './outbox.service';
import { ReplenishmentService } from './replenishment.service';
import { ProcessOrderFulfillmentDto } from './dto/process-order-fulfillment.dto';

@Injectable()
export class OrderFulfillmentService {
  private readonly idempotencyStore = new Map<string, ApiResponse<WorkflowExecutionResult>>();

  constructor(
    @Inject(SalesService) private readonly salesService: SalesService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(ReplenishmentService) private readonly replenishmentService: ReplenishmentService
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async processOrderFulfillment(
    dto: ProcessOrderFulfillmentDto,
    headerIdempotencyKey?: string
  ): Promise<ApiResponse<WorkflowExecutionResult>> {
    const idempotencyKey = headerIdempotencyKey || dto.idempotencyKey;

    if (idempotencyKey) {
      const cached = this.idempotencyStore.get(idempotencyKey);
      if (cached) {
        return cached;
      }
    }

    if (!dto.salesOrderId) {
      throw new BadRequestException('salesOrderId is required');
    }
    if (!dto.warehouseId) {
      throw new BadRequestException('warehouseId is required');
    }

    const workflowId = `wf-of-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.auditService.record({
      workflowId,
      action: 'WORKFLOW_ORDER_FULFILLMENT_STARTED',
      input: { salesOrderId: dto.salesOrderId, warehouseId: dto.warehouseId },
      status: 'SUCCESS'
    });

    this.outboxService.publish({
      aggregateType: 'SalesOrder',
      aggregateId: dto.salesOrderId,
      eventType: 'OrderFulfillmentStarted',
      payload: { workflowId, salesOrderId: dto.salesOrderId, warehouseId: dto.warehouseId }
    });

    const orderResponse = await this.salesService.getSalesOrder(dto.salesOrderId);
    const order = orderResponse.data;
    if (!order) {
      throw new NotFoundException(`Sales order [${dto.salesOrderId}] not found`);
    }

    if (order.status !== SalesOrderStatus.DRAFT && order.status !== SalesOrderStatus.PENDING_APPROVAL && order.status !== SalesOrderStatus.APPROVED) {
      throw new BadRequestException(`Sales order is in status [${order.status}], cannot fulfill`);
    }

    let allItemsAvailable = true;
    for (const item of order.items) {
      const availResponse = await this.inventoryService.checkAvailability(
        dto.warehouseId,
        item.productId,
        item.quantity
      );
      if (!availResponse.data?.isAvailable) {
        allItemsAvailable = false;
        break;
      }
    }

    if (!allItemsAvailable) {
      this.auditService.record({
        workflowId,
        action: 'WORKFLOW_STOCK_UNAVAILABLE',
        input: { salesOrderId: order.id, warehouseId: dto.warehouseId },
        status: 'FAILURE',
        reasoning: 'Insufficient stock to fulfill all order items'
      });

      this.auditService.record({
        workflowId,
        action: 'WORKFLOW_ORDER_FULFILLMENT_FAILED',
        input: { salesOrderId: order.id, warehouseId: dto.warehouseId },
        status: 'FAILURE',
        reasoning: 'Insufficient stock in warehouse'
      });

      this.outboxService.publish({
        aggregateType: 'SalesOrder',
        aggregateId: order.id,
        eventType: 'OrderFulfillmentFailed',
        payload: { workflowId, salesOrderId: order.id, reason: 'Insufficient stock in warehouse' }
      });

      await this.replenishmentService.evaluateAndTriggerReplenishment(dto.warehouseId);

      const result: WorkflowExecutionResult = {
        workflowId,
        salesOrderId: order.id,
        status: WorkflowStatus.FAILED,
        sales: {
          orderId: order.id,
          status: order.status
        },
        inventory: {
          checked: true,
          reserved: false,
          reservations: []
        },
        idempotencyKey,
        error: 'Insufficient stock in warehouse',
        timestamp: new Date().toISOString()
      };

      const response: ApiResponse<WorkflowExecutionResult> = {
        success: false,
        data: result,
        error: {
          code: 'STOCK_UNAVAILABLE',
          message: 'Insufficient stock in warehouse to fulfill order'
        },
        metadata: this.buildMetadata()
      };

      if (idempotencyKey) {
        this.idempotencyStore.set(idempotencyKey, response);
      }

      return response;
    }

    const reservations: WorkflowReservationDetail[] = [];
    try {
      for (const item of order.items) {
        const reserveResponse = await this.inventoryService.reserveStock({
          warehouseId: dto.warehouseId,
          productId: item.productId,
          quantity: item.quantity,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}:${item.id}` : undefined
        });

        if (reserveResponse.data) {
          reservations.push({
            reservationId: reserveResponse.data.id,
            productId: reserveResponse.data.productId,
            quantity: reserveResponse.data.quantity,
            warehouseId: reserveResponse.data.warehouseId
          });
        }
      }
    } catch (err: any) {
      for (const reservation of reservations) {
        try {
          await this.inventoryService.cancelReservation(reservation.reservationId);
        } catch {
          // best-effort compensation
        }
      }

      this.auditService.record({
        workflowId,
        action: 'WORKFLOW_ORDER_FULFILLMENT_FAILED',
        input: { salesOrderId: order.id, warehouseId: dto.warehouseId },
        status: 'FAILURE',
        reasoning: err.message
      });

      this.outboxService.publish({
        aggregateType: 'SalesOrder',
        aggregateId: order.id,
        eventType: 'OrderFulfillmentFailed',
        payload: { workflowId, salesOrderId: order.id, reason: err.message }
      });

      const failedResult: WorkflowExecutionResult = {
        workflowId,
        salesOrderId: order.id,
        status: WorkflowStatus.FAILED,
        sales: { orderId: order.id, status: order.status },
        inventory: { checked: true, reserved: false, reservations: [] },
        idempotencyKey,
        error: err.message,
        timestamp: new Date().toISOString()
      };

      const failedResponse: ApiResponse<WorkflowExecutionResult> = {
        success: false,
        data: failedResult,
        error: { code: 'RESERVATION_FAILED', message: err.message },
        metadata: this.buildMetadata()
      };

      if (idempotencyKey) {
        this.idempotencyStore.set(idempotencyKey, failedResponse);
      }

      return failedResponse;
    }

    let finalOrderStatus = order.status;
    if (order.status !== SalesOrderStatus.APPROVED) {
      await this.salesService.updateOrderStatus(order.id, SalesOrderStatus.APPROVED);
    }
    const fulfilledResponse = await this.salesService.updateOrderStatus(
      order.id,
      SalesOrderStatus.FULFILLED
    );
    finalOrderStatus = (fulfilledResponse.data?.status || SalesOrderStatus.FULFILLED) as any;

    this.outboxService.publish({
      aggregateType: 'SalesOrder',
      aggregateId: order.id,
      eventType: 'OrderFulfilled',
      payload: {
        workflowId,
        salesOrderId: order.id,
        warehouseId: dto.warehouseId,
        reservations
      }
    });

    this.auditService.record({
      workflowId,
      action: 'WORKFLOW_ORDER_FULFILLMENT_SUCCESS',
      input: { salesOrderId: order.id, warehouseId: dto.warehouseId },
      output: { reservations, orderStatus: finalOrderStatus },
      status: 'SUCCESS'
    });

    for (const item of order.items) {
      await this.replenishmentService.checkAndTriggerReplenishment(dto.warehouseId, item.productId);
    }

    const result: WorkflowExecutionResult = {
      workflowId,
      salesOrderId: order.id,
      status: WorkflowStatus.COMPLETED,
      sales: {
        orderId: order.id,
        status: finalOrderStatus
      },
      inventory: {
        checked: true,
        reserved: true,
        reservations
      },
      idempotencyKey,
      timestamp: new Date().toISOString()
    };

    const response: ApiResponse<WorkflowExecutionResult> = {
      success: true,
      data: result,
      metadata: this.buildMetadata()
    };

    if (idempotencyKey) {
      this.idempotencyStore.set(idempotencyKey, response);
    }

    return response;
  }
}
