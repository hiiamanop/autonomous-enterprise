export class CreateTicketDto {
  title!: string;
  description?: string;
  source!: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  workflowId?: string;
}
