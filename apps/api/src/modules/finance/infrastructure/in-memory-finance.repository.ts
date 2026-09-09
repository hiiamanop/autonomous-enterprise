import { Injectable } from '@nestjs/common';
import type {
  CostCenter,
  Budget,
  BudgetAllocation,
  Expense
} from '../domain/finance.types';
import type { IFinanceRepository } from '../domain/finance.repository.interface';

@Injectable()
export class InMemoryFinanceRepository implements IFinanceRepository {
  private readonly costCenters: Map<string, CostCenter> = new Map();
  private readonly budgets: Map<string, Budget> = new Map();
  private readonly allocations: Map<string, BudgetAllocation> = new Map();
  private readonly expenses: Map<string, Expense> = new Map();

  async createCostCenter(costCenter: CostCenter): Promise<CostCenter> {
    this.costCenters.set(costCenter.id, { ...costCenter });
    return { ...costCenter };
  }

  async findCostCenterById(id: string): Promise<CostCenter | null> {
    const costCenter = this.costCenters.get(id);
    if (!costCenter) {
      return null;
    }
    return { ...costCenter };
  }

  async findCostCenterByCode(code: string): Promise<CostCenter | null> {
    for (const costCenter of this.costCenters.values()) {
      if (costCenter.code === code) {
        return { ...costCenter };
      }
    }
    return null;
  }

  async findAllCostCenters(): Promise<CostCenter[]> {
    return Array.from(this.costCenters.values()).map((cc) => ({ ...cc }));
  }

  async createBudget(budget: Budget): Promise<Budget> {
    this.budgets.set(budget.id, {
      ...budget,
      allocations: budget.allocations ? [...budget.allocations] : []
    });
    return {
      ...budget,
      allocations: budget.allocations ? [...budget.allocations] : []
    };
  }

  async findBudgetById(id: string): Promise<Budget | null> {
    const budget = this.budgets.get(id);
    if (!budget) {
      return null;
    }
    const allocs = await this.findBudgetAllocations(budget.id);
    return {
      ...budget,
      allocations: allocs
    };
  }

  async findAllBudgets(): Promise<Budget[]> {
    const result: Budget[] = [];
    for (const budget of this.budgets.values()) {
      const allocs = await this.findBudgetAllocations(budget.id);
      result.push({
        ...budget,
        allocations: allocs
      });
    }
    return result;
  }

  async updateBudget(budget: Budget): Promise<Budget> {
    if (!this.budgets.has(budget.id)) {
      throw new Error(`Budget [${budget.id}] not found`);
    }
    this.budgets.set(budget.id, {
      ...budget,
      allocations: budget.allocations ? [...budget.allocations] : []
    });
    return {
      ...budget,
      allocations: budget.allocations ? [...budget.allocations] : []
    };
  }

  async createBudgetAllocation(allocation: BudgetAllocation): Promise<BudgetAllocation> {
    this.allocations.set(allocation.id, { ...allocation });
    return { ...allocation };
  }

  async findBudgetAllocations(budgetId?: string): Promise<BudgetAllocation[]> {
    return Array.from(this.allocations.values())
      .filter((a) => (budgetId ? a.budgetId === budgetId : true))
      .map((a) => ({ ...a }));
  }

  async createExpense(expense: Expense): Promise<Expense> {
    this.expenses.set(expense.id, { ...expense });
    return { ...expense };
  }

  async findExpenseById(id: string): Promise<Expense | null> {
    const expense = this.expenses.get(id);
    if (!expense) {
      return null;
    }
    return { ...expense };
  }

  async findAllExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values()).map((e) => ({ ...e }));
  }

  async updateExpense(expense: Expense): Promise<Expense> {
    if (!this.expenses.has(expense.id)) {
      throw new Error(`Expense [${expense.id}] not found`);
    }
    this.expenses.set(expense.id, { ...expense });
    return { ...expense };
  }
}
