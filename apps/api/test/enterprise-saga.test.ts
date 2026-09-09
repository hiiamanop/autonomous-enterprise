import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { EnterpriseSagaService } from '../src/modules/workflow/enterprise-saga.service';
import { TenantContextStorage } from '@autonomous-enterprise/shared';

const response = <T>(data: T) => ({ success: true, data });
const dto = {
  salesOrderId: 'so-1', warehouseId: 'wh-1', supplierId: 'sup-1', budgetId: 'budget-1', employeeId: 'emp-1',
  deploymentName: 'api', namespace: 'default', targetReplicas: 3, scalingCostUsd: 5, autoScale: true
};

function makeService(financeAvailable = true) {
  const inventory = {
    reserveStock: vi.fn().mockResolvedValue(response({ id: 'reservation-1' })),
    cancelReservation: vi.fn().mockResolvedValue(response({ id: 'reservation-1' }))
  };
  const infrastructure = {
    requestScaling: vi.fn().mockResolvedValue(response({ id: 'scaling-1' })),
    rollbackScaling: vi.fn().mockResolvedValue(response({ id: 'scaling-1' }))
  };
  const ticketing = { createTicket: vi.fn().mockResolvedValue(response({ id: 'ticket-1' })) };
  const service = new EnterpriseSagaService(
    { getSalesOrder: vi.fn().mockResolvedValue(response({ id: 'so-1', items: [{ productId: 'product-1', quantity: 2 }], totalAmount: 100 })) } as never,
    inventory as never,
    { createPurchaseRequest: vi.fn().mockResolvedValue(response({ id: 'pr-1' })) } as never,
    { checkBudgetAvailability: vi.fn().mockResolvedValue(financeAvailable), createBudgetAllocation: vi.fn().mockResolvedValue(response({})) } as never,
    { createJournal: vi.fn().mockResolvedValue(response({})) } as never,
    { requestOvertime: vi.fn().mockResolvedValue(response({})) } as never,
    infrastructure as never,
    { record: vi.fn() } as never,
    ticketing as never,
    { publish: vi.fn() } as never
  );
  return { service, inventory, infrastructure, ticketing };
}

describe('EnterpriseSagaService', () => {
  it('completes all eight domain steps', async () => {
    const { service } = makeService();
    const result = await TenantContextStorage.run({ tenantId: 'tenant-a', actorId: 'admin' }, () => service.process(dto));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ status: 'COMPLETED', sales: 'COMPLETED', inventory: 'COMPLETED', procurement: 'COMPLETED', finance: 'COMPLETED', hris: 'COMPLETED', accounting: 'COMPLETED', infrastructure: 'COMPLETED', compensation: 'SKIPPED' });
  });

  it('compensates reservations and scaling and creates an escalation ticket on finance failure', async () => {
    const { service, inventory, infrastructure, ticketing } = makeService(false);
    const result = await TenantContextStorage.run({ tenantId: 'tenant-a', actorId: 'admin' }, () => service.process(dto));
    expect(result.success).toBe(false);
    expect(inventory.cancelReservation).toHaveBeenCalledWith('reservation-1');
    expect(infrastructure.rollbackScaling).toHaveBeenCalledWith('scaling-1');
    expect(ticketing.createTicket).toHaveBeenCalled();
    expect(result.data?.compensation).toBe('COMPLETED');
  });

  it('requires tenant context and preserves tenant-scoped execution', async () => {
    const { service } = makeService();
    await expect(service.process(dto)).rejects.toBeInstanceOf(UnauthorizedException);
    const result = await TenantContextStorage.run({ tenantId: 'tenant-b', actorId: 'operator' }, () => service.process({ ...dto, autoScale: false }));
    expect(result.data?.tenantId).toBe('tenant-b');
    expect(result.data?.infrastructure).toBe('SKIPPED');
  });
});
