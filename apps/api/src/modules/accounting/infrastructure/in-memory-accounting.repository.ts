import { Injectable } from '@nestjs/common';
import type {
  ChartOfAccount,
  Journal,
  Invoice,
  Payment
} from '../domain/accounting.types';
import type { IAccountingRepository } from '../domain/accounting.repository.interface';
import type { JournalStatus, InvoiceStatus } from '@autonomous-enterprise/contracts';

@Injectable()
export class InMemoryAccountingRepository implements IAccountingRepository {
  private readonly accounts: Map<string, ChartOfAccount> = new Map();
  private readonly journals: Map<string, Journal> = new Map();
  private readonly invoices: Map<string, Invoice> = new Map();
  private readonly payments: Map<string, Payment> = new Map();

  async createChartOfAccount(account: ChartOfAccount): Promise<ChartOfAccount> {
    this.accounts.set(account.id, { ...account });
    return { ...account };
  }

  async findChartOfAccountById(id: string): Promise<ChartOfAccount | null> {
    const a = this.accounts.get(id);
    return a ? { ...a } : null;
  }

  async findChartOfAccountByCode(code: string): Promise<ChartOfAccount | null> {
    for (const a of this.accounts.values()) {
      if (a.code === code) return { ...a };
    }
    return null;
  }

  async findAllChartOfAccounts(): Promise<ChartOfAccount[]> {
    return Array.from(this.accounts.values()).map((a) => ({ ...a }));
  }

  async createJournal(journal: Journal): Promise<Journal> {
    this.journals.set(journal.id, { ...journal });
    return { ...journal };
  }

  async findJournalById(id: string): Promise<Journal | null> {
    const j = this.journals.get(id);
    return j ? { ...j } : null;
  }

  async findAllJournals(status?: JournalStatus): Promise<Journal[]> {
    return Array.from(this.journals.values())
      .filter((j) => (status ? j.status === status : true))
      .map((j) => ({ ...j }));
  }

  async updateJournal(journal: Journal): Promise<Journal> {
    if (!this.journals.has(journal.id)) {
      throw new Error(`Journal ${journal.id} not found`);
    }
    this.journals.set(journal.id, { ...journal });
    return { ...journal };
  }

  async createInvoice(invoice: Invoice): Promise<Invoice> {
    this.invoices.set(invoice.id, { ...invoice });
    return { ...invoice };
  }

  async findInvoiceById(id: string): Promise<Invoice | null> {
    const inv = this.invoices.get(id);
    return inv ? { ...inv } : null;
  }

  async findAllInvoices(status?: InvoiceStatus): Promise<Invoice[]> {
    return Array.from(this.invoices.values())
      .filter((i) => (status ? i.status === status : true))
      .map((i) => ({ ...i }));
  }

  async updateInvoice(invoice: Invoice): Promise<Invoice> {
    if (!this.invoices.has(invoice.id)) {
      throw new Error(`Invoice ${invoice.id} not found`);
    }
    this.invoices.set(invoice.id, { ...invoice });
    return { ...invoice };
  }

  async createPayment(payment: Payment): Promise<Payment> {
    this.payments.set(payment.id, { ...payment });
    return { ...payment };
  }

  async findPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter((p) => p.invoiceId === invoiceId)
      .map((p) => ({ ...p }));
  }

  async findAllPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values()).map((p) => ({ ...p }));
  }
}
