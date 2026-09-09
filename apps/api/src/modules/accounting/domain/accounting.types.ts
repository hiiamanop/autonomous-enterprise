import type {
  ChartOfAccountType,
  JournalStatus,
  JournalEntryDirection,
  InvoiceType,
  InvoiceStatus
} from '@autonomous-enterprise/contracts';

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: ChartOfAccountType;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  journalId: string;
  accountId: string;
  direction: JournalEntryDirection;
  amount: number;
  memo?: string;
  createdAt: string;
}

export interface Journal {
  id: string;
  reference: string;
  description?: string;
  status: JournalStatus;
  postedAt?: string;
  entries?: JournalEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  type: InvoiceType;
  referenceId?: string;
  counterparty?: string;
  amount: number;
  paidAmount?: number;
  status: InvoiceStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method?: string;
  status?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt?: string;
}
