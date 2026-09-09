import type {
  PrismaClient,
  CostCenter as PrismaCostCenter,
  Budget as PrismaBudget,
  BudgetAllocation as PrismaBudgetAllocation,
  Expense as PrismaExpense,
  ExpenseStatus as PrismaExpenseStatus
} from '@prisma/client';

export interface CostCenterEntity {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAllocationEntity {
  id: string;
  budgetId: string;
  amount: number;
  purpose?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetEntity {
  id: string;
  costCenterId?: string;
  name?: string;
  year?: number;
  amount?: number;
  totalAmount: number;
  allocatedAmount?: number;
  spentAmount: number;
  period?: string;
  allocations?: BudgetAllocationEntity[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseEntity {
  id: string;
  budgetId?: string;
  costCenterId?: string;
  allocationId?: string;
  amount: number;
  description?: string;
  category?: string;
  status: PrismaExpenseStatus;
  requestedBy?: string;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IFinanceRepository {
  createCostCenter(costCenter: CostCenterEntity): Promise<CostCenterEntity>;
  findCostCenterById(id: string): Promise<CostCenterEntity | null>;
  findCostCenterByCode(code: string): Promise<CostCenterEntity | null>;
  findAllCostCenters(): Promise<CostCenterEntity[]>;

  createBudget(budget: BudgetEntity): Promise<BudgetEntity>;
  findBudgetById(id: string): Promise<BudgetEntity | null>;
  findAllBudgets(): Promise<BudgetEntity[]>;
  updateBudget(budget: BudgetEntity): Promise<BudgetEntity>;

  createBudgetAllocation(allocation: BudgetAllocationEntity): Promise<BudgetAllocationEntity>;
  findBudgetAllocations(budgetId?: string): Promise<BudgetAllocationEntity[]>;

  createExpense(expense: ExpenseEntity): Promise<ExpenseEntity>;
  findExpenseById(id: string): Promise<ExpenseEntity | null>;
  findAllExpenses(): Promise<ExpenseEntity[]>;
  updateExpense(expense: ExpenseEntity): Promise<ExpenseEntity>;
}

export class PrismaFinanceRepository implements IFinanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapCostCenter(raw: PrismaCostCenter): CostCenterEntity {
    return {
      id: raw.id,
      name: raw.name,
      code: raw.code,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapBudgetAllocation(raw: PrismaBudgetAllocation): BudgetAllocationEntity {
    return {
      id: raw.id,
      budgetId: raw.budgetId,
      amount: raw.amount,
      category: raw.category,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapBudget(raw: PrismaBudget & { budgetAllocations?: PrismaBudgetAllocation[] }): BudgetEntity {
    return {
      id: raw.id,
      costCenterId: raw.costCenterId,
      year: raw.year,
      totalAmount: raw.amount,
      amount: raw.amount,
      spentAmount: raw.spentAmount,
      allocations: raw.budgetAllocations?.map((a) => this.mapBudgetAllocation(a)),
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapExpense(raw: PrismaExpense): ExpenseEntity {
    return {
      id: raw.id,
      budgetId: raw.budgetId ?? undefined,
      allocationId: raw.allocationId ?? undefined,
      amount: raw.amount,
      category: raw.category,
      status: raw.status,
      notes: raw.notes ?? undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async createCostCenter(costCenter: CostCenterEntity): Promise<CostCenterEntity> {
    const created = await this.prisma.costCenter.create({
      data: {
        id: costCenter.id,
        name: costCenter.name,
        code: costCenter.code,
        createdAt: costCenter.createdAt ? new Date(costCenter.createdAt) : undefined,
        updatedAt: costCenter.updatedAt ? new Date(costCenter.updatedAt) : undefined
      }
    });
    return this.mapCostCenter(created);
  }

  async findCostCenterById(id: string): Promise<CostCenterEntity | null> {
    const found = await this.prisma.costCenter.findUnique({
      where: { id }
    });
    return found ? this.mapCostCenter(found) : null;
  }

  async findCostCenterByCode(code: string): Promise<CostCenterEntity | null> {
    const found = await this.prisma.costCenter.findUnique({
      where: { code }
    });
    return found ? this.mapCostCenter(found) : null;
  }

  async findAllCostCenters(): Promise<CostCenterEntity[]> {
    const centers = await this.prisma.costCenter.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return centers.map((c) => this.mapCostCenter(c));
  }

  async createBudget(budget: BudgetEntity): Promise<BudgetEntity> {
    const created = await this.prisma.budget.create({
      data: {
        id: budget.id,
        costCenterId: budget.costCenterId || 'default',
        year: budget.year || new Date().getFullYear(),
        amount: budget.amount || budget.totalAmount,
        spentAmount: budget.spentAmount || 0,
        createdAt: budget.createdAt ? new Date(budget.createdAt) : undefined,
        updatedAt: budget.updatedAt ? new Date(budget.updatedAt) : undefined
      },
      include: { budgetAllocations: true }
    });
    return this.mapBudget(created);
  }

  async findBudgetById(id: string): Promise<BudgetEntity | null> {
    const found = await this.prisma.budget.findUnique({
      where: { id },
      include: { budgetAllocations: true }
    });
    return found ? this.mapBudget(found) : null;
  }

  async findAllBudgets(): Promise<BudgetEntity[]> {
    const budgets = await this.prisma.budget.findMany({
      include: { budgetAllocations: true },
      orderBy: { createdAt: 'desc' }
    });
    return budgets.map((b) => this.mapBudget(b));
  }

  async updateBudget(budget: BudgetEntity): Promise<BudgetEntity> {
    const updated = await this.prisma.budget.update({
      where: { id: budget.id },
      data: {
        amount: budget.amount || budget.totalAmount,
        spentAmount: budget.spentAmount,
        updatedAt: new Date()
      },
      include: { budgetAllocations: true }
    });
    return this.mapBudget(updated);
  }

  async createBudgetAllocation(allocation: BudgetAllocationEntity): Promise<BudgetAllocationEntity> {
    const created = await this.prisma.budgetAllocation.create({
      data: {
        id: allocation.id,
        budgetId: allocation.budgetId,
        category: allocation.category || allocation.purpose || 'GENERAL',
        amount: allocation.amount,
        spentAmount: 0,
        createdAt: allocation.createdAt ? new Date(allocation.createdAt) : undefined,
        updatedAt: allocation.updatedAt ? new Date(allocation.updatedAt) : undefined
      }
    });
    return this.mapBudgetAllocation(created);
  }

  async findBudgetAllocations(budgetId?: string): Promise<BudgetAllocationEntity[]> {
    const allocations = await this.prisma.budgetAllocation.findMany({
      where: {
        budgetId: budgetId || undefined
      }
    });
    return allocations.map((a) => this.mapBudgetAllocation(a));
  }

  async createExpense(expense: ExpenseEntity): Promise<ExpenseEntity> {
    const created = await this.prisma.expense.create({
      data: {
        id: expense.id,
        budgetId: expense.budgetId,
        allocationId: expense.allocationId,
        amount: expense.amount,
        category: expense.category || 'GENERAL',
        status: expense.status,
        notes: expense.notes || expense.description,
        createdAt: expense.createdAt ? new Date(expense.createdAt) : undefined,
        updatedAt: expense.updatedAt ? new Date(expense.updatedAt) : undefined
      }
    });
    return this.mapExpense(created);
  }

  async findExpenseById(id: string): Promise<ExpenseEntity | null> {
    const found = await this.prisma.expense.findUnique({
      where: { id }
    });
    return found ? this.mapExpense(found) : null;
  }

  async findAllExpenses(): Promise<ExpenseEntity[]> {
    const expenses = await this.prisma.expense.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return expenses.map((e) => this.mapExpense(e));
  }

  async updateExpense(expense: ExpenseEntity): Promise<ExpenseEntity> {
    const updated = await this.prisma.expense.update({
      where: { id: expense.id },
      data: {
        status: expense.status,
        notes: expense.notes || expense.description,
        updatedAt: new Date()
      }
    });
    return this.mapExpense(updated);
  }
}
