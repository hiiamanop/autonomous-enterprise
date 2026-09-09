import type {
  Ticket,
  TicketComment,
  TicketAssignment,
  TicketSla
} from './ticketing.types';

export interface ITicketingRepository {
  createTicket(ticket: Ticket): Promise<Ticket>;
  updateTicket(ticket: Ticket): Promise<Ticket>;
  findTicketById(id: string): Promise<Ticket | null>;
  findAllTickets(status?: string): Promise<Ticket[]>;

  addComment(comment: TicketComment): Promise<TicketComment>;
  findCommentsByTicket(ticketId: string): Promise<TicketComment[]>;

  createAssignment(assignment: TicketAssignment): Promise<TicketAssignment>;
  findAssignmentsByTicket(ticketId: string): Promise<TicketAssignment[]>;

  createSla(sla: TicketSla): Promise<TicketSla>;
  updateSla(sla: TicketSla): Promise<TicketSla>;
  findSlaByTicket(ticketId: string): Promise<TicketSla | null>;
  findBreachedOrPendingSlas(): Promise<TicketSla[]>;
}

export const TICKETING_REPOSITORY = 'TICKETING_REPOSITORY';
