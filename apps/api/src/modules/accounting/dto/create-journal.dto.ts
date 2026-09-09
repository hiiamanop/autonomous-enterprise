import type { JournalEntryDirection } from '@autonomous-enterprise/contracts';

export class JournalEntryItemDto {
  accountId!: string;
  direction!: JournalEntryDirection;
  amount!: number;
  memo?: string;
}

export class CreateJournalDto {
  reference!: string;
  description?: string;
  entries!: JournalEntryItemDto[];
}
