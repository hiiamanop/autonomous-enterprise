import type {
  PrismaClient,
  ChartOfAccount as PrismaChartOfAccount,
  ChartOfAccountType as PrismaChartOfAccountType,
  Journal as PrismaJournal,
  JournalStatus as PrismaJournalStatus,
  JournalEntry as PrismaJournalEntry,
  JournalEntryDirection as PrismaJournalEntryDirection,
  Invoice as PrismaInvoice,
  InvoiceType as PrismaInvoiceType,
  InvoiceStatus as PrismaInvoiceStatus,
  Payment as PrismaPayment,
  PaymentMethod as PrismaPaymentMethod
} from '@prisma/client';

export type ChartOfAccountTypeEnum = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface ChartOfAccountEntity {
  id: string;
  code: string;
  name: string;
  type: ChartOfAccountTypeEnum;
  createdAt: string;
  updatedAt: string;
}

export type JournalStatusEnum = 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'REJECTED' | 'REVERSED';
export type JournalEntryDirectionEnum = 'DEBIT' | 'CREDIT';

export interface JournalEntryEntity {
  id: string;
  journalId: string;
  accountId: string;
  direction: JournalEntryDirectionEnum;
  amount: number;
  memo?: string;
  createdAt: string;
}

export interface JournalEntity {
  id: string;
  reference: string;
  description?: string;
  status: JournalStatusEnum;
  postedAt?: string;
  entries?: JournalEntryEntity[];
  createdAt: string;
  updatedAt: string;
}

export type InvoiceTypeEnum = 'RECEIVABLE' | 'PAYABLE';
export type InvoiceStatusEnum = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' | 'OVERDUE' | 'ISSUED' | 'PARTIALLY_PAID';

export interface InvoiceEntity {
  id: string;
  invoiceNumber: string;
  type: InvoiceTypeEnum;
  amount: number;
  status: InvoiceStatusEnum;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEntity {
  id: string;
  invoiceId: string;
  amount: number;
  method?: string;
  paidAt?: string;
  createdAt: string;
}

export interface IAccountingRepository {
  createChartOfAccount(account: ChartOfAccountEntity): Promise<ChartOfAccountEntity>;
  findChartOfAccountById(id: string): Promise<ChartOfAccountEntity | null>;
  findChartOfAccountByCode(code: string): Promise<ChartOfAccountEntity | null>;
  findAllChartOfAccounts(): Promise<ChartOfAccountEntity[]>;

  createJournal(journal: JournalEntity): Promise<JournalEntity>;
  findJournalById(id: string): Promise<JournalEntity | null>;
  findAllJournals(status?: JournalStatusEnum | string): Promise<JournalEntity[]>;
  updateJournal(journal: JournalEntity): Promise<JournalEntity>;

  createInvoice(invoice: InvoiceEntity): Promise<InvoiceEntity>;
  findInvoiceById(id: string): Promise<InvoiceEntity | null>;
  findAllInvoices(type?: InvoiceTypeEnum | string, status?: InvoiceStatusEnum | string): Promise<InvoiceEntity[]>;
  updateInvoice(invoice: InvoiceEntity): Promise<InvoiceEntity>;

  createPayment(payment: PaymentEntity): Promise<PaymentEntity>;
  findPaymentsByInvoice(invoiceId: string): Promise<PaymentEntity[]>;
}

export class PrismaAccountingRepository implements IAccountingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapChartOfAccount(raw: PrismaChartOfAccount): ChartOfAccountEntity {
    return {
      id: raw.id,
      code: raw.code,
      name: raw.name,
      type: raw.type as ChartOfAccountTypeEnum,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapJournalEntry(raw: PrismaJournalEntry): JournalEntryEntity {
    return {
      id: raw.id,
      journalId: raw.journalId,
      accountId: raw.accountId,
      direction: raw.direction as JournalEntryDirectionEnum,
      amount: raw.amount,
      memo: raw.memo ?? undefined,
      createdAt: raw.createdAt.toISOString()
    };
  }

  private mapJournal(raw: PrismaJournal & { entries?: PrismaJournalEntry[] }): JournalEntity {
    return {
      id: raw.id,
      reference: raw.reference,
      description: raw.description ?? undefined,
      status: raw.status as JournalStatusEnum,
      postedAt: raw.postedAt ? raw.postedAt.toISOString() : undefined,
      entries: raw.entries?.map((e) => this.mapJournalEntry(e)),
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapInvoice(raw: PrismaInvoice): InvoiceEntity {
    return {
      id: raw.id,
      invoiceNumber: raw.invoiceNumber,
      type: raw.type as InvoiceTypeEnum,
      amount: raw.amount,
      status: raw.status as InvoiceStatusEnum,
      dueDate: raw.dueDate.toISOString(),
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapPayment(raw: PrismaPayment): PaymentEntity {
    return {
      id: raw.id,
      invoiceId: raw.invoiceId,
      amount: raw.amount,
      method: raw.method,
      paidAt: raw.paidAt.toISOString(),
      createdAt: raw.createdAt.toISOString()
    };
  }

  async createChartOfAccount(account: ChartOfAccountEntity): Promise<ChartOfAccountEntity> {
    const created = await this.prisma.chartOfAccount.create({
      data: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type as PrismaChartOfAccountType,
        createdAt: account.createdAt ? new Date(account.createdAt) : undefined,
        updatedAt: account.updatedAt ? new Date(account.updatedAt) : undefined
      }
    });
    return this.mapChartOfAccount(created);
  }

  async findChartOfAccountById(id: string): Promise<ChartOfAccountEntity | null> {
    const found = await this.prisma.chartOfAccount.findUnique({
      where: { id }
    });
    return found ? this.mapChartOfAccount(found) : null;
  }

  async findChartOfAccountByCode(code: string): Promise<ChartOfAccountEntity | null> {
    const found = await this.prisma.chartOfAccount.findUnique({
      where: { code }
    });
    return found ? this.mapChartOfAccount(found) : null;
  }

  async findAllChartOfAccounts(): Promise<ChartOfAccountEntity[]> {
    const accounts = await this.prisma.chartOfAccount.findMany({
      orderBy: { code: 'asc' }
    });
    return accounts.map((a) => this.mapChartOfAccount(a));
  }

  async createJournal(journal: JournalEntity): Promise<JournalEntity> {
    const created = await this.prisma.journal.create({
      data: {
        id: journal.id,
        reference: journal.reference,
        description: journal.description,
        status: journal.status as PrismaJournalStatus,
        postedAt: journal.postedAt ? new Date(journal.postedAt) : undefined,
        createdAt: journal.createdAt ? new Date(journal.createdAt) : undefined,
        updatedAt: journal.updatedAt ? new Date(journal.updatedAt) : undefined,
        entries: {
          create: (journal.entries || []).map((e) => ({
            id: e.id,
            accountId: e.accountId,
            direction: e.direction as PrismaJournalEntryDirection,
            amount: e.amount,
            memo: e.memo,
            createdAt: e.createdAt ? new Date(e.createdAt) : undefined
          }))
        }
      },
      include: { entries: true }
    });
    return this.mapJournal(created);
  }

  async findJournalById(id: string): Promise<JournalEntity | null> {
    const found = await this.prisma.journal.findUnique({
      where: { id },
      include: { entries: true }
    });
    return found ? this.mapJournal(found) : null;
  }

  async findAllJournals(status?: JournalStatusEnum | string): Promise<JournalEntity[]> {
    const journals = await this.prisma.journal.findMany({
      where: {
        status: status ? (status as PrismaJournalStatus) : undefined
      },
      include: { entries: true },
      orderBy: { createdAt: 'desc' }
    });
    return journals.map((j) => this.mapJournal(j));
  }

  async updateJournal(journal: JournalEntity): Promise<JournalEntity> {
    const updated = await this.prisma.journal.update({
      where: { id: journal.id },
      data: {
        status: journal.status as PrismaJournalStatus,
        description: journal.description,
        postedAt: journal.postedAt ? new Date(journal.postedAt) : undefined,
        updatedAt: new Date()
      },
      include: { entries: true }
    });
    return this.mapJournal(updated);
  }

  async createInvoice(invoice: InvoiceEntity): Promise<InvoiceEntity> {
    const created = await this.prisma.invoice.create({
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber || `INV-${Date.now()}`,
        type: invoice.type as PrismaInvoiceType,
        amount: invoice.amount,
        status: (invoice.status === 'ISSUED' ? 'DRAFT' : invoice.status) as PrismaInvoiceStatus,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : new Date(),
        createdAt: invoice.createdAt ? new Date(invoice.createdAt) : undefined,
        updatedAt: invoice.updatedAt ? new Date(invoice.updatedAt) : undefined
      }
    });
    return this.mapInvoice(created);
  }

  async findInvoiceById(id: string): Promise<InvoiceEntity | null> {
    const found = await this.prisma.invoice.findUnique({
      where: { id }
    });
    return found ? this.mapInvoice(found) : null;
  }

  async findAllInvoices(type?: InvoiceTypeEnum | string, status?: InvoiceStatusEnum | string): Promise<InvoiceEntity[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        type: type ? (type as PrismaInvoiceType) : undefined,
        status: status ? (status as PrismaInvoiceStatus) : undefined
      },
      orderBy: { createdAt: 'desc' }
    });
    return invoices.map((i) => this.mapInvoice(i));
  }

  async updateInvoice(invoice: InvoiceEntity): Promise<InvoiceEntity> {
    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: (invoice.status === 'ISSUED' ? 'DRAFT' : invoice.status) as PrismaInvoiceStatus,
        amount: invoice.amount,
        updatedAt: new Date()
      }
    });
    return this.mapInvoice(updated);
  }

  async createPayment(payment: PaymentEntity): Promise<PaymentEntity> {
    const created = await this.prisma.payment.create({
      data: {
        id: payment.id,
        invoiceId: payment.invoiceId,
        amount: payment.amount,
        method: (payment.method || 'BANK_TRANSFER') as PrismaPaymentMethod,
        paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
        createdAt: payment.createdAt ? new Date(payment.createdAt) : undefined
      }
    });
    return this.mapPayment(created);
  }

  async findPaymentsByInvoice(invoiceId: string): Promise<PaymentEntity[]> {
    const payments = await this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paidAt: 'desc' }
    });
    return payments.map((p) => this.mapPayment(p));
  }
}
