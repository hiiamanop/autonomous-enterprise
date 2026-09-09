import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import { ExpenseStatus } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import type {
  CostCenter,
  Budget,
  BudgetAllocation,
  Expense
} from './domain/finance.types';
import {
  FINANCE_REPOSITORY,
  type IFinanceRepository
} from './domain/finance.repository.interface';
import type { CreateCostCenterDto } from './dto/create-cost-center.dto';
import type { CreateBudgetDto } from './dto/create-budget.dto';
import type { CreateBudgetAllocationDto } from './dto/create-budget-allocation.dto';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { ApproveExpenseDto } from './dto/approve-expense.dto';

@Injectable()
export class FinanceService {
  constructor(
    @Inject(FINANCE_REPOSITORY)
    private readonly repository: IFinanceRepository
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async createCostCenter(dto: CreateCostCenterDto): Promise<ApiResponse<CostCenter>> {
    if (!dto.name || !dto.code) {
      throw new BadRequestException('Cost center code and name are required');
    }

    const existing = await this.repository.findCostCenterByCode(dto.code);
    if (existing) {
      throw new BadRequestException(`Cost center code ${dto.code} already exists`);
    }

    const now = new Date().toISOString();
    const costCenter: CostCenter = {
      id: randomUUID(),
      name: dto.name,
      code: dto.code,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.repository.createCostCenter(costCenter);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async listCostCenters(): Promise<ApiResponse<CostCenter[]>> {
    const costCenters = await this.repository.findAllCostCenters();
    return {
      success: true,
      data: costCenters,
      metadata: this.buildMetadata()
    };
  }

  async getCostCenter(id: string): Promise<ApiResponse<CostCenter>> {
    const costCenter = await this.repository.findCostCenterById(id);
    if (!costCenter) {
      throw new NotFoundException(`Cost center ${id} not found`);
    }
    return {
      success: true,
      data: costCenter,
      metadata: this.buildMetadata()
    };
  }

  async createBudget(dto: CreateBudgetDto): Promise<ApiResponse<Budget>> {
    if (!dto.name || dto.totalAmount === undefined || !dto.period) {
      throw new BadRequestException('Budget name, totalAmount, and period are required');
    }

    if (dto.totalAmount < 0) {
      throw new BadRequestException('Total amount must be greater than or equal to 0');
    }

    if (dto.costCenterId) {
      const costCenter = await this.repository.findCostCenterById(dto.costCenterId);
      if (!costCenter) {
        throw new NotFoundException(`Cost center ${dto.costCenterId} not found`);
      }
    }

    const now = new Date().toISOString();
    const budget: Budget = {
      id: randomUUID(),
      costCenterId: dto.costCenterId,
      name: dto.name,
      totalAmount: dto.totalAmount,
      allocatedAmount: 0,
      spentAmount: 0,
      period: dto.period,
      allocations: [],
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.repository.createBudget(budget);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async listBudgets(): Promise<ApiResponse<Budget[]>> {
    const budgets = await this.repository.findAllBudgets();
    return {
      success: true,
      data: budgets,
      metadata: this.buildMetadata()
    };
  }

  async getBudget(id: string): Promise<ApiResponse<Budget>> {
    const budget = await this.repository.findBudgetById(id);
    if (!budget) {
      throw new NotFoundException(`Budget ${id} not found`);
    }
    return {
      success: true,
      data: budget,
      metadata: this.buildMetadata()
    };
  }

  async createBudgetAllocation(dto: CreateBudgetAllocationDto): Promise<ApiResponse<BudgetAllocation>> {
    return this.allocateBudget(dto);
  }

  async allocateBudget(dto: CreateBudgetAllocationDto): Promise<ApiResponse<BudgetAllocation>> {
    if (!dto.budgetId || dto.amount === undefined || !dto.purpose) {
      throw new BadRequestException('budgetId, amount, and purpose are required');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Allocation amount must be greater than 0');
    }

    const budget = await this.repository.findBudgetById(dto.budgetId);
    if (!budget) {
      throw new NotFoundException(`Budget ${dto.budgetId} not found`);
    }

    const remainingToAllocate = budget.totalAmount - budget.allocatedAmount;
    if (dto.amount > remainingToAllocate) {
      throw new BadRequestException(
        `Allocation amount ${dto.amount} exceeds remaining unallocated budget of ${remainingToAllocate}`
      );
    }

    const now = new Date().toISOString();
    const allocation: BudgetAllocation = {
      id: randomUUID(),
      budgetId: dto.budgetId,
      amount: dto.amount,
      purpose: dto.purpose,
      createdAt: now,
      updatedAt: now
    };

    const savedAllocation = await this.repository.createBudgetAllocation(allocation);

    budget.allocatedAmount += dto.amount;
    budget.updatedAt = now;
    await this.repository.updateBudget(budget);

    return {
      success: true,
      data: savedAllocation,
      metadata: this.buildMetadata()
    };
  }

  async listBudgetAllocations(budgetId?: string): Promise<ApiResponse<BudgetAllocation[]>> {
    const allocations = await this.repository.findBudgetAllocations(budgetId);
    return {
      success: true,
      data: allocations,
      metadata: this.buildMetadata()
    };
  }

  async checkBudgetAvailability(budgetId: string, amount: number): Promise<boolean> {
    const budget = await this.repository.findBudgetById(budgetId);
    if (!budget) {
      return false;
    }
    const unallocated = budget.totalAmount - budget.allocatedAmount;
    const unspent = budget.totalAmount - budget.spentAmount;
    return unallocated >= amount && unspent >= amount;
  }

  async createExpense(dto: CreateExpenseDto): Promise<ApiResponse<Expense>> {
    if (dto.amount === undefined || !dto.description || !dto.requestedBy) {
      throw new BadRequestException('amount, description, and requestedBy are required');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Expense amount must be greater than 0');
    }

    if (dto.budgetId) {
      const budget = await this.repository.findBudgetById(dto.budgetId);
      if (!budget) {
        throw new NotFoundException(`Budget ${dto.budgetId} not found`);
      }
    }

    if (dto.costCenterId) {
      const costCenter = await this.repository.findCostCenterById(dto.costCenterId);
      if (!costCenter) {
        throw new NotFoundException(`Cost center ${dto.costCenterId} not found`);
      }
    }

    const now = new Date().toISOString();
    const expense: Expense = {
      id: randomUUID(),
      budgetId: dto.budgetId,
      costCenterId: dto.costCenterId,
      amount: dto.amount,
      description: dto.description,
      status: ExpenseStatus.PENDING,
      requestedBy: dto.requestedBy,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.repository.createExpense(expense);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async listExpenses(): Promise<ApiResponse<Expense[]>> {
    const expenses = await this.repository.findAllExpenses();
    return {
      success: true,
      data: expenses,
      metadata: this.buildMetadata()
    };
  }

  async getExpense(id: string): Promise<ApiResponse<Expense>> {
    const expense = await this.repository.findExpenseById(id);
    if (!expense) {
      throw new NotFoundException(`Expense ${id} not found`);
    }
    return {
      success: true,
      data: expense,
      metadata: this.buildMetadata()
    };
  }

  async approveExpense(expenseId: string, dto: ApproveExpenseDto): Promise<ApiResponse<Expense>> {
    const expense = await this.repository.findExpenseById(expenseId);
    if (!expense) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }

    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(`Cannot approve expense in status ${expense.status}`);
    }

    if (!dto.approvedBy) {
      throw new BadRequestException('approvedBy is required');
    }

    if (expense.budgetId) {
      const isAvailable = await this.checkBudgetAvailability(expense.budgetId, expense.amount);
      if (!isAvailable) {
        throw new BadRequestException('Expense approval failed: insufficient budget available');
      }

      const budget = await this.repository.findBudgetById(expense.budgetId);
      if (budget) {
        budget.spentAmount += expense.amount;
        budget.updatedAt = new Date().toISOString();
        await this.repository.updateBudget(budget);
      }
    }

    const now = new Date().toISOString();
    expense.status = ExpenseStatus.APPROVED;
    expense.approvedBy = dto.approvedBy;
    expense.updatedAt = now;

    const updated = await this.repository.updateExpense(expense);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async rejectExpense(expenseId: string): Promise<ApiResponse<Expense>> {
    const expense = await this.repository.findExpenseById(expenseId);
    if (!expense) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }

    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(`Cannot reject expense in status ${expense.status}`);
    }

    const now = new Date().toISOString();
    expense.status = ExpenseStatus.REJECTED;
    expense.updatedAt = now;

    const updated = await this.repository.updateExpense(expense);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }
}
