import type {
  ChartOfAccount,
  Journal,
  Invoice,
  Payment
} from './accounting.types';
import type { JournalStatus, InvoiceStatus } from '@autonomous-enterprise/contracts';

export interface IAccountingRepository {
  createChartOfAccount(account: ChartOfAccount): Promise<ChartOfAccount>;
  findChartOfAccountById(id: string): Promise<ChartOfAccount | null>;
  findChartOfAccountByCode(code: string): Promise<ChartOfAccount | null>;
  findAllChartOfAccounts(): Promise<ChartOfAccount[]>;

  createJournal(journal: Journal): Promise<Journal>;
  findJournalById(id: string): Promise<Journal | null>;
  findAllJournals(status?: JournalStatus): Promise<Journal[]>;
  updateJournal(journal: Journal): Promise<Journal>;

  createInvoice(invoice: Invoice): Promise<Invoice>;
  findInvoiceById(id: string): Promise<Invoice | null>;
  findAllInvoices(status?: InvoiceStatus): Promise<Invoice[]>;
  updateInvoice(invoice: Invoice): Promise<Invoice>;

  createPayment(payment: Payment): Promise<Payment>;
  findPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]>;
  findAllPayments(): Promise<Payment[]>;
}

export const ACCOUNTING_REPOSITORY = 'ACCOUNTING_REPOSITORY';
