import type { InvoiceType } from '@autonomous-enterprise/contracts';

export class CreateInvoiceDto {
  type!: InvoiceType;
  referenceId?: string;
  counterparty!: string;
  amount!: number;
  dueDate?: string;
}
