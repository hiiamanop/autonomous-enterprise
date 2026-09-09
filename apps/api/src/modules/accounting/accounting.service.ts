import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import {
  JournalStatus,
  JournalEntryDirection,
  InvoiceStatus,
  InvoiceType
} from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import type {
  ChartOfAccount,
  Journal,
  JournalEntry,
  Invoice,
  Payment
} from './domain/accounting.types';
import {
  ACCOUNTING_REPOSITORY,
  type IAccountingRepository
} from './domain/accounting.repository.interface';
import type { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import type { CreateJournalDto } from './dto/create-journal.dto';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { RecordPaymentDto } from './dto/record-payment.dto';

@Injectable()
export class AccountingService {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY)
    private readonly repository: IAccountingRepository
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async createChartOfAccount(dto: CreateChartOfAccountDto): Promise<ApiResponse<ChartOfAccount>> {
    if (!dto.name || !dto.code || !dto.type) {
      throw new BadRequestException('Chart of account code, name, and type are required');
    }

    const existing = await this.repository.findChartOfAccountByCode(dto.code);
    if (existing) {
      throw new BadRequestException(`Chart of account code ${dto.code} already exists`);
    }

    const now = new Date().toISOString();
    const account: ChartOfAccount = {
      id: randomUUID(),
      code: dto.code,
      name: dto.name,
      type: dto.type,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.repository.createChartOfAccount(account);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async getChartOfAccount(id: string): Promise<ApiResponse<ChartOfAccount>> {
    const account = await this.repository.findChartOfAccountById(id);
    if (!account) {
      throw new NotFoundException(`Chart of account ${id} not found`);
    }
    return {
      success: true,
      data: account,
      metadata: this.buildMetadata()
    };
  }

  async listChartOfAccounts(): Promise<ApiResponse<ChartOfAccount[]>> {
    const accounts = await this.repository.findAllChartOfAccounts();
    return {
      success: true,
      data: accounts,
      metadata: this.buildMetadata()
    };
  }

  async createJournal(dto: CreateJournalDto): Promise<ApiResponse<Journal>> {
    if (!dto.reference || !dto.entries || dto.entries.length === 0) {
      throw new BadRequestException('Journal reference and non-empty entries are required');
    }

    if (dto.entries.length < 2) {
      throw new BadRequestException('Journal must have at least 2 entries for double-entry bookkeeping');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const entry of dto.entries) {
      if (typeof entry.amount !== 'number' || entry.amount <= 0 || isNaN(entry.amount)) {
        throw new BadRequestException('Journal entry amount must be greater than zero');
      }

      const account = await this.repository.findChartOfAccountById(entry.accountId);
      if (!account) {
        throw new NotFoundException(`Chart of account not found: ${entry.accountId}`);
      }

      if (entry.direction === JournalEntryDirection.DEBIT) {
        totalDebit += entry.amount;
      } else if (entry.direction === JournalEntryDirection.CREDIT) {
        totalCredit += entry.amount;
      } else {
        throw new BadRequestException(`Invalid entry direction: ${entry.direction}`);
      }
    }

    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      throw new BadRequestException('Journal entries must balance: total debit must equal total credit');
    }

    const journalId = randomUUID();
    const now = new Date().toISOString();

    const entries: JournalEntry[] = dto.entries.map((item) => ({
      id: randomUUID(),
      journalId,
      accountId: item.accountId,
      direction: item.direction,
      amount: item.amount,
      memo: item.memo,
      createdAt: now
    }));

    const journal: Journal = {
      id: journalId,
      reference: dto.reference,
      description: dto.description,
      status: JournalStatus.DRAFT,
      entries,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.repository.createJournal(journal);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async getJournal(id: string): Promise<ApiResponse<Journal>> {
    const journal = await this.repository.findJournalById(id);
    if (!journal) {
      throw new NotFoundException(`Journal ${id} not found`);
    }
    return {
      success: true,
      data: journal,
      metadata: this.buildMetadata()
    };
  }

  async listJournals(status?: JournalStatus): Promise<ApiResponse<Journal[]>> {
    const journals = await this.repository.findAllJournals(status);
    return {
      success: true,
      data: journals,
      metadata: this.buildMetadata()
    };
  }

  async postJournal(id: string): Promise<ApiResponse<Journal>> {
    const journal = await this.repository.findJournalById(id);
    if (!journal) {
      throw new NotFoundException(`Journal ${id} not found`);
    }

    if (journal.status === JournalStatus.POSTED) {
      throw new BadRequestException('Journal is already posted');
    }

    if (journal.status === JournalStatus.REVERSED) {
      throw new BadRequestException(`Cannot post a reversed journal ${id}`);
    }

    journal.status = JournalStatus.POSTED;
    journal.postedAt = new Date().toISOString();
    journal.updatedAt = new Date().toISOString();

    const saved = await this.repository.updateJournal(journal);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async reverseJournal(id: string, reason?: string): Promise<ApiResponse<Journal>> {
    const original = await this.repository.findJournalById(id);
    if (!original) {
      throw new NotFoundException(`Journal ${id} not found`);
    }

    if (original.status !== JournalStatus.POSTED) {
      throw new BadRequestException(`Only POSTED journals can be reversed; current status: ${original.status}`);
    }

    original.status = JournalStatus.REVERSED;
    original.updatedAt = new Date().toISOString();
    await this.repository.updateJournal(original);

    const reversalId = randomUUID();
    const now = new Date().toISOString();

    const reversalEntries: JournalEntry[] = (original.entries || []).map((entry) => ({
      id: randomUUID(),
      journalId: reversalId,
      accountId: entry.accountId,
      direction:
        entry.direction === JournalEntryDirection.DEBIT
          ? JournalEntryDirection.CREDIT
          : JournalEntryDirection.DEBIT,
      amount: entry.amount,
      memo: `Reversal: ${entry.memo || ''}`.trim(),
      createdAt: now
    }));

    const reversalJournal: Journal = {
      id: reversalId,
      reference: `REVERSAL-${original.reference}`,
      description: `Reversal of journal ${original.reference}${reason ? `: ${reason}` : ''}`,
      status: JournalStatus.POSTED,
      postedAt: now,
      entries: reversalEntries,
      createdAt: now,
      updatedAt: now
    };

    const savedReversal = await this.repository.createJournal(reversalJournal);
    return {
      success: true,
      data: savedReversal,
      metadata: this.buildMetadata()
    };
  }

  async createInvoice(dto: CreateInvoiceDto): Promise<ApiResponse<Invoice>> {
    if (!dto.type || typeof dto.amount !== 'number' || dto.amount <= 0 || isNaN(dto.amount)) {
      throw new BadRequestException('Invoice type and positive amount are required');
    }

    const now = new Date().toISOString();
    const invoice: Invoice = {
      id: randomUUID(),
      type: dto.type,
      referenceId: dto.referenceId,
      counterparty: dto.counterparty || 'DEFAULT_COUNTERPARTY',
      amount: dto.amount,
      paidAmount: 0,
      status: InvoiceStatus.DRAFT,
      dueDate: dto.dueDate,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.repository.createInvoice(invoice);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async getInvoice(id: string): Promise<ApiResponse<Invoice>> {
    const invoice = await this.repository.findInvoiceById(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return {
      success: true,
      data: invoice,
      metadata: this.buildMetadata()
    };
  }

  async listInvoices(status?: InvoiceStatus): Promise<ApiResponse<Invoice[]>> {
    const invoices = await this.repository.findAllInvoices(status);
    return {
      success: true,
      data: invoices,
      metadata: this.buildMetadata()
    };
  }

  async issueInvoice(id: string): Promise<ApiResponse<Invoice>> {
    const invoice = await this.repository.findInvoiceById(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Only DRAFT invoices can be issued; current status: ${invoice.status}`);
    }

    invoice.status = InvoiceStatus.ISSUED as any;
    invoice.updatedAt = new Date().toISOString();

    const saved = await this.repository.updateInvoice(invoice);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async recordPayment(dto: RecordPaymentDto): Promise<ApiResponse<Payment>> {
    if (!dto.invoiceId || typeof dto.amount !== 'number' || dto.amount <= 0 || isNaN(dto.amount)) {
      throw new BadRequestException('invoiceId and positive payment amount are required');
    }

    const invoice = await this.repository.findInvoiceById(dto.invoiceId);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException(`Invoice ${dto.invoiceId} is already fully paid`);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(`Cannot record payment on a CANCELLED invoice ${dto.invoiceId}`);
    }

    const currentPaid = invoice.paidAmount || 0;
    const remainingBalance = invoice.amount - currentPaid;

    if (dto.amount > remainingBalance + 0.0001) {
      throw new BadRequestException(
        'Payment amount exceeds remaining invoice balance'
      );
    }

    const newPaidAmount = currentPaid + dto.amount;
    invoice.paidAmount = newPaidAmount;

    if (Math.abs(newPaidAmount - invoice.amount) < 0.0001) {
      invoice.status = InvoiceStatus.PAID;
    } else {
      invoice.status = InvoiceStatus.PARTIALLY_PAID as any;
    }

    invoice.updatedAt = new Date().toISOString();
    await this.repository.updateInvoice(invoice);

    const now = new Date().toISOString();
    const payment: Payment = {
      id: randomUUID(),
      invoiceId: dto.invoiceId,
      amount: dto.amount,
      method: dto.method,
      status: 'COMPLETED',
      paidAt: now,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.repository.createPayment(payment);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async listPayments(invoiceId?: string): Promise<ApiResponse<Payment[]>> {
    const payments = invoiceId
      ? await this.repository.findPaymentsByInvoiceId(invoiceId)
      : await this.repository.findAllPayments();
    return {
      success: true,
      data: payments,
      metadata: this.buildMetadata()
    };
  }

  async listPaymentsByInvoice(invoiceId: string): Promise<ApiResponse<Payment[]>> {
    return this.listPayments(invoiceId);
  }
}
