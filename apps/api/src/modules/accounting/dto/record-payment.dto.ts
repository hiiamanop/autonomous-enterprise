export class RecordPaymentDto {
  invoiceId!: string;
  amount!: number;
  method?: string;
}
