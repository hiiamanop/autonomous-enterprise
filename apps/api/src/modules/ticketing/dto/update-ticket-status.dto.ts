export class UpdateTicketStatusDto {
  status!:
    | 'OPEN'
    | 'TRIAGED'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'ESCALATED'
    | 'HUMAN_REVIEW'
    | 'RESOLVED'
    | 'CLOSED';
  assignedTo?: string;
}
