import type { ExpenseStatus } from '@autonomous-enterprise/contracts';

export interface CostCenter {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAllocation {
  id: string;
  budgetId: string;
  amount: number;
  purpose: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  costCenterId?: string;
  name: string;
  totalAmount: number;
  allocatedAmount: number;
  spentAmount: number;
  period: string;
  allocations?: BudgetAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  budgetId?: string;
  costCenterId?: string;
  amount: number;
  description: string;
  status: ExpenseStatus;
  requestedBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}
