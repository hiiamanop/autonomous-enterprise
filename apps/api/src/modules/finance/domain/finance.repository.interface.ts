import type {
  CostCenter,
  Budget,
  BudgetAllocation,
  Expense
} from './finance.types';

export interface IFinanceRepository {
  createCostCenter(costCenter: CostCenter): Promise<CostCenter>;
  findCostCenterById(id: string): Promise<CostCenter | null>;
  findCostCenterByCode(code: string): Promise<CostCenter | null>;
  findAllCostCenters(): Promise<CostCenter[]>;

  createBudget(budget: Budget): Promise<Budget>;
  findBudgetById(id: string): Promise<Budget | null>;
  findAllBudgets(): Promise<Budget[]>;
  updateBudget(budget: Budget): Promise<Budget>;

  createBudgetAllocation(allocation: BudgetAllocation): Promise<BudgetAllocation>;
  findBudgetAllocations(budgetId?: string): Promise<BudgetAllocation[]>;

  createExpense(expense: Expense): Promise<Expense>;
  findExpenseById(id: string): Promise<Expense | null>;
  findAllExpenses(): Promise<Expense[]>;
  updateExpense(expense: Expense): Promise<Expense>;
}

export const FINANCE_REPOSITORY = 'FINANCE_REPOSITORY';
