export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TicketStatus =
  | 'OPEN'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'HUMAN_REVIEW'
  | 'RESOLVED'
  | 'CLOSED';

export interface Ticket {
  id: string;
  workflowId?: string;
  title: string;
  description?: string;
  source: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface TicketAssignment {
  id: string;
  ticketId: string;
  assigneeId: string;
  assignedBy?: string;
  assignedAt: string;
}

export interface TicketSla {
  id: string;
  ticketId: string;
  responseDueAt: string;
  resolutionDueAt: string;
  respondedAt?: string;
  resolvedAt?: string;
  responseBreached: boolean;
  resolutionBreached: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketWithDetails extends Ticket {
  comments: TicketComment[];
  assignments: TicketAssignment[];
  sla?: TicketSla;
}
