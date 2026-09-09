import { Injectable } from '@nestjs/common';
import type {
  Ticket,
  TicketComment,
  TicketAssignment,
  TicketSla
} from '../domain/ticketing.types';
import type { ITicketingRepository } from '../domain/ticketing.repository.interface';

@Injectable()
export class InMemoryTicketingRepository implements ITicketingRepository {
  private readonly tickets: Map<string, Ticket> = new Map();
  private readonly comments: Map<string, TicketComment> = new Map();
  private readonly assignments: Map<string, TicketAssignment> = new Map();
  private readonly slas: Map<string, TicketSla> = new Map();

  async createTicket(ticket: Ticket): Promise<Ticket> {
    this.tickets.set(ticket.id, { ...ticket });
    return { ...ticket };
  }

  async updateTicket(ticket: Ticket): Promise<Ticket> {
    if (!this.tickets.has(ticket.id)) {
      throw new Error(`Ticket [${ticket.id}] not found`);
    }
    this.tickets.set(ticket.id, { ...ticket });
    return { ...ticket };
  }

  async findTicketById(id: string): Promise<Ticket | null> {
    const ticket = this.tickets.get(id);
    if (!ticket) {
      return null;
    }
    return { ...ticket };
  }

  async findAllTickets(status?: string): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter((t) => (status ? t.status === status : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((t) => ({ ...t }));
  }

  async addComment(comment: TicketComment): Promise<TicketComment> {
    this.comments.set(comment.id, { ...comment });
    return { ...comment };
  }

  async findCommentsByTicket(ticketId: string): Promise<TicketComment[]> {
    return Array.from(this.comments.values())
      .filter((c) => c.ticketId === ticketId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((c) => ({ ...c }));
  }

  async createAssignment(assignment: TicketAssignment): Promise<TicketAssignment> {
    this.assignments.set(assignment.id, { ...assignment });
    return { ...assignment };
  }

  async findAssignmentsByTicket(ticketId: string): Promise<TicketAssignment[]> {
    return Array.from(this.assignments.values())
      .filter((a) => a.ticketId === ticketId)
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())
      .map((a) => ({ ...a }));
  }

  async createSla(sla: TicketSla): Promise<TicketSla> {
    this.slas.set(sla.ticketId, { ...sla });
    return { ...sla };
  }

  async updateSla(sla: TicketSla): Promise<TicketSla> {
    if (!this.slas.has(sla.ticketId)) {
      throw new Error(`SLA for ticket [${sla.ticketId}] not found`);
    }
    this.slas.set(sla.ticketId, { ...sla });
    return { ...sla };
  }

  async findSlaByTicket(ticketId: string): Promise<TicketSla | null> {
    const sla = this.slas.get(ticketId);
    if (!sla) {
      return null;
    }
    return { ...sla };
  }

  async findBreachedOrPendingSlas(): Promise<TicketSla[]> {
    return Array.from(this.slas.values())
      .filter((s) => !s.resolvedAt)
      .map((s) => ({ ...s }));
  }
}
