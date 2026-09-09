import { Inject, Injectable } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { ProcurementService } from '../procurement/procurement.service';
import { AuditService } from '../../common/audit/audit.service';
import { OutboxService } from './outbox.service';

@Injectable()
export class ReplenishmentService {
  constructor(
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(ProcurementService) private readonly procurementService: ProcurementService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(OutboxService) private readonly outboxService: OutboxService
  ) {}

  async checkAndTriggerReplenishment(
    warehouseIdOrTenant: string,
    warehouseIdOrProduct?: string,
    productIdArg?: string
  ): Promise<void> {
    const warehouseId = productIdArg ? warehouseIdOrProduct! : warehouseIdOrTenant;
    const productId = productIdArg ? productIdArg : warehouseIdOrProduct!;

    const rulesResponse = await this.inventoryService.listReorderRules(warehouseId, productId);
    const rules = rulesResponse.data ?? [];
    if (rules.length === 0) {
      return;
    }

    const availabilityResponse = await this.inventoryService.checkAvailability(
      warehouseId,
      productId,
      1
    );
    const availableQuantity = availabilityResponse.data?.availableQuantity ?? 0;

    for (const rule of rules) {
      if (availableQuantity < rule.minQuantity) {
        const requestResponse = await this.procurementService.createPurchaseRequest({
          requestedBy: 'AI_INVENTORY_AGENT',
          productId,
          quantity: rule.reorderQuantity,
          reason: `Automated replenishment: available quantity [${availableQuantity}] below minimum [${rule.minQuantity}] for warehouse [${warehouseId}]`
        });

        const pr = requestResponse.data;
        if (pr) {
          this.outboxService.publish({
            aggregateType: 'PurchaseRequest',
            aggregateId: pr.id,
            eventType: 'PurchaseRequestCreated',
            payload: {
              purchaseRequestId: pr.id,
              productId: pr.productId,
              quantity: pr.quantity,
              requestedBy: pr.requestedBy,
              warehouseId
            }
          });

          this.auditService.record({
            action: 'REPLENISHMENT_TRIGGERED',
            input: { warehouseId, productId, availableQuantity, minQuantity: rule.minQuantity },
            output: { purchaseRequestId: pr.id, reorderQuantity: rule.reorderQuantity },
            status: 'SUCCESS',
            reasoning: `Stock level ${availableQuantity} below threshold ${rule.minQuantity}`
          });
        }
      }
    }
  }

  async evaluateAndTriggerReplenishment(warehouseIdOrTenant: string, warehouseIdArg?: string): Promise<void> {
    const warehouseId = warehouseIdArg || warehouseIdOrTenant;
    const rulesResponse = await this.inventoryService.listReorderRules(warehouseId);
    const rules = rulesResponse.data ?? [];

    for (const rule of rules) {
      await this.checkAndTriggerReplenishment(warehouseId, rule.productId);
    }
  }
}
