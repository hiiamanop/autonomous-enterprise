import { describe, expect, it } from 'vitest';
import {
  Role,
  PurchaseRequestStatus,
  PurchaseOrderStatus,
  ExpenseStatus,
  DomainEvents,
  PurchaseRequestCreated,
  PurchaseOrderApproved,
  GoodsReceiptRecorded,
  ExpenseApproved,
  BudgetExceeded
} from '../src/index';

describe('Contracts Package', () => {
  it('should define human and AI agent roles', () => {
    expect(Role.SUPER_ADMIN).toBe('SUPER_ADMIN');
    expect(Role.TENANT_ADMIN).toBe('TENANT_ADMIN');
    expect(Role.AI_SALES_AGENT).toBe('AI_SALES_AGENT');
    expect(Role.AI_FINANCE_AGENT).toBe('AI_FINANCE_AGENT');
    expect(Role.AI_ORCHESTRATOR).toBe('AI_ORCHESTRATOR');
  });

  it('should define procurement and finance status enums', () => {
    expect(PurchaseRequestStatus.PENDING).toBe('PENDING');
    expect(PurchaseRequestStatus.APPROVED).toBe('APPROVED');
    expect(PurchaseRequestStatus.REJECTED).toBe('REJECTED');
    expect(PurchaseRequestStatus.CONVERTED).toBe('CONVERTED');

    expect(PurchaseOrderStatus.DRAFT).toBe('DRAFT');
    expect(PurchaseOrderStatus.PENDING_APPROVAL).toBe('PENDING_APPROVAL');
    expect(PurchaseOrderStatus.APPROVED).toBe('APPROVED');
    expect(PurchaseOrderStatus.REJECTED).toBe('REJECTED');
    expect(PurchaseOrderStatus.RECEIVED).toBe('RECEIVED');
    expect(PurchaseOrderStatus.CANCELLED).toBe('CANCELLED');

    expect(ExpenseStatus.PENDING).toBe('PENDING');
    expect(ExpenseStatus.APPROVED).toBe('APPROVED');
    expect(ExpenseStatus.REJECTED).toBe('REJECTED');
    expect(ExpenseStatus.PAID).toBe('PAID');
  });

  it('should define domain event constants', () => {
    expect(PurchaseRequestCreated).toBe('PurchaseRequestCreated');
    expect(PurchaseOrderApproved).toBe('PurchaseOrderApproved');
    expect(GoodsReceiptRecorded).toBe('GoodsReceiptRecorded');
    expect(ExpenseApproved).toBe('ExpenseApproved');
    expect(BudgetExceeded).toBe('BudgetExceeded');
    expect(DomainEvents.PurchaseRequestCreated).toBe('PurchaseRequestCreated');
  });
});
