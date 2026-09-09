import type {
  PrismaClient,
  Ticket as PrismaTicket,
  TicketPriority as PrismaTicketPriority,
  TicketStatus as PrismaTicketStatus,
  TicketComment as PrismaTicketComment,
  TicketAssignment as PrismaTicketAssignment,
  TicketSla as PrismaTicketSla
} from '@prisma/client';

export type TicketPriorityEnum = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketStatusEnum =
  | 'OPEN'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'HUMAN_REVIEW'
  | 'RESOLVED'
  | 'CLOSED';

export interface TicketEntity {
  id: string;
  workflowId?: string;
  title: string;
  description?: string;
  source: string;
  priority: TicketPriorityEnum;
  status: TicketStatusEnum;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketCommentEntity {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface TicketAssignmentEntity {
  id: string;
  ticketId: string;
  assigneeId: string;
  assignedBy?: string;
  assignedAt: string;
}

export interface TicketSlaEntity {
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

export interface ITicketingRepository {
  createTicket(ticket: TicketEntity): Promise<TicketEntity>;
  updateTicket(ticket: TicketEntity): Promise<TicketEntity>;
  findTicketById(id: string): Promise<TicketEntity | null>;
  findAllTickets(status?: TicketStatusEnum | string): Promise<TicketEntity[]>;

  addComment(comment: TicketCommentEntity): Promise<TicketCommentEntity>;
  findCommentsByTicket(ticketId: string): Promise<TicketCommentEntity[]>;

  createAssignment(assignment: TicketAssignmentEntity): Promise<TicketAssignmentEntity>;
  findAssignmentsByTicket(ticketId: string): Promise<TicketAssignmentEntity[]>;

  createOrUpdateSla(sla: TicketSlaEntity): Promise<TicketSlaEntity>;
  findSlaByTicket(ticketId: string): Promise<TicketSlaEntity | null>;
}

export class PrismaTicketingRepository implements ITicketingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapTicket(raw: PrismaTicket): TicketEntity {
    return {
      id: raw.id,
      workflowId: raw.workflowId ?? undefined,
      title: raw.title,
      description: raw.description ?? undefined,
      source: raw.source,
      priority: raw.priority as TicketPriorityEnum,
      status: raw.status as TicketStatusEnum,
      assignedTo: raw.assignedTo ?? undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapComment(raw: PrismaTicketComment): TicketCommentEntity {
    return {
      id: raw.id,
      ticketId: raw.ticketId,
      authorId: raw.authorId,
      body: raw.body,
      createdAt: raw.createdAt.toISOString()
    };
  }

  private mapAssignment(raw: PrismaTicketAssignment): TicketAssignmentEntity {
    return {
      id: raw.id,
      ticketId: raw.ticketId,
      assigneeId: raw.assigneeId,
      assignedBy: raw.assignedBy ?? undefined,
      assignedAt: raw.assignedAt.toISOString()
    };
  }

  private mapSla(raw: PrismaTicketSla): TicketSlaEntity {
    return {
      id: raw.id,
      ticketId: raw.ticketId,
      responseDueAt: raw.responseDueAt.toISOString(),
      resolutionDueAt: raw.resolutionDueAt.toISOString(),
      respondedAt: raw.respondedAt ? raw.respondedAt.toISOString() : undefined,
      resolvedAt: raw.resolvedAt ? raw.resolvedAt.toISOString() : undefined,
      responseBreached: raw.responseBreached,
      resolutionBreached: raw.resolutionBreached,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async createTicket(ticket: TicketEntity): Promise<TicketEntity> {
    const created = await this.prisma.ticket.create({
      data: {
        id: ticket.id,
        workflowId: ticket.workflowId,
        title: ticket.title,
        description: ticket.description,
        source: ticket.source,
        priority: ticket.priority as PrismaTicketPriority,
        status: ticket.status as PrismaTicketStatus,
        assignedTo: ticket.assignedTo,
        createdAt: ticket.createdAt ? new Date(ticket.createdAt) : undefined,
        updatedAt: ticket.updatedAt ? new Date(ticket.updatedAt) : undefined
      }
    });
    return this.mapTicket(created);
  }

  async updateTicket(ticket: TicketEntity): Promise<TicketEntity> {
    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        workflowId: ticket.workflowId,
        title: ticket.title,
        description: ticket.description,
        source: ticket.source,
        priority: ticket.priority as PrismaTicketPriority,
        status: ticket.status as PrismaTicketStatus,
        assignedTo: ticket.assignedTo,
        updatedAt: new Date()
      }
    });
    return this.mapTicket(updated);
  }

  async findTicketById(id: string): Promise<TicketEntity | null> {
    const found = await this.prisma.ticket.findUnique({
      where: { id }
    });
    return found ? this.mapTicket(found) : null;
  }

  async findAllTickets(status?: TicketStatusEnum | string): Promise<TicketEntity[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        status: status ? (status as PrismaTicketStatus) : undefined
      },
      orderBy: { createdAt: 'desc' }
    });
    return tickets.map((t) => this.mapTicket(t));
  }

  async addComment(comment: TicketCommentEntity): Promise<TicketCommentEntity> {
    const created = await this.prisma.ticketComment.create({
      data: {
        id: comment.id,
        ticketId: comment.ticketId,
        authorId: comment.authorId,
        body: comment.body,
        createdAt: comment.createdAt ? new Date(comment.createdAt) : undefined
      }
    });
    return this.mapComment(created);
  }

  async findCommentsByTicket(ticketId: string): Promise<TicketCommentEntity[]> {
    const comments = await this.prisma.ticketComment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' }
    });
    return comments.map((c) => this.mapComment(c));
  }

  async createAssignment(assignment: TicketAssignmentEntity): Promise<TicketAssignmentEntity> {
    const created = await this.prisma.ticketAssignment.create({
      data: {
        id: assignment.id,
        ticketId: assignment.ticketId,
        assigneeId: assignment.assigneeId,
        assignedBy: assignment.assignedBy,
        assignedAt: assignment.assignedAt ? new Date(assignment.assignedAt) : undefined
      }
    });
    return this.mapAssignment(created);
  }

  async findAssignmentsByTicket(ticketId: string): Promise<TicketAssignmentEntity[]> {
    const assignments = await this.prisma.ticketAssignment.findMany({
      where: { ticketId },
      orderBy: { assignedAt: 'desc' }
    });
    return assignments.map((a) => this.mapAssignment(a));
  }

  async createOrUpdateSla(sla: TicketSlaEntity): Promise<TicketSlaEntity> {
    const upserted = await this.prisma.ticketSla.upsert({
      where: { ticketId: sla.ticketId },
      create: {
        id: sla.id,
        ticketId: sla.ticketId,
        responseDueAt: new Date(sla.responseDueAt),
        resolutionDueAt: new Date(sla.resolutionDueAt),
        respondedAt: sla.respondedAt ? new Date(sla.respondedAt) : undefined,
        resolvedAt: sla.resolvedAt ? new Date(sla.resolvedAt) : undefined,
        responseBreached: sla.responseBreached,
        resolutionBreached: sla.resolutionBreached,
        createdAt: sla.createdAt ? new Date(sla.createdAt) : undefined,
        updatedAt: sla.updatedAt ? new Date(sla.updatedAt) : undefined
      },
      update: {
        responseDueAt: new Date(sla.responseDueAt),
        resolutionDueAt: new Date(sla.resolutionDueAt),
        respondedAt: sla.respondedAt ? new Date(sla.respondedAt) : undefined,
        resolvedAt: sla.resolvedAt ? new Date(sla.resolvedAt) : undefined,
        responseBreached: sla.responseBreached,
        resolutionBreached: sla.resolutionBreached,
        updatedAt: new Date()
      }
    });
    return this.mapSla(upserted);
  }

  async findSlaByTicket(ticketId: string): Promise<TicketSlaEntity | null> {
    const found = await this.prisma.ticketSla.findUnique({
      where: { ticketId }
    });
    return found ? this.mapSla(found) : null;
  }
}
