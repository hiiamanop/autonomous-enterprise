import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import type {
  Ticket,
  TicketAssignment,
  TicketComment,
  TicketSla,
  TicketWithDetails
} from './domain/ticketing.types';
import {
  TICKETING_REPOSITORY,
  type ITicketingRepository
} from './domain/ticketing.repository.interface';
import type { CreateTicketDto } from './dto/create-ticket.dto';
import type { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import type { AddCommentDto } from './dto/add-comment.dto';
import type { AssignTicketDto } from './dto/assign-ticket.dto';
import type { AttachSlaDto } from './dto/attach-sla.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['TRIAGED', 'ASSIGNED', 'ESCALATED', 'CLOSED'],
  TRIAGED: ['ASSIGNED', 'ESCALATED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'ESCALATED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'ESCALATED', 'CLOSED'],
  ESCALATED: ['HUMAN_REVIEW', 'CLOSED'],
  HUMAN_REVIEW: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: []
};

@Injectable()
export class TicketingService {
  constructor(
    @Inject(TICKETING_REPOSITORY) private readonly repository: ITicketingRepository
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  private async findTicketOrThrow(id: string): Promise<Ticket> {
    const ticket = await this.repository.findTicketById(id);
    if (!ticket) {
      throw new NotFoundException(`Ticket [${id}] not found`);
    }
    return ticket;
  }

  async createTicket(dto: CreateTicketDto): Promise<ApiResponse<Ticket>> {
    if (!dto.title || dto.title.trim() === '') {
      throw new BadRequestException('Ticket title is required');
    }

    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: `tkt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workflowId: dto.workflowId,
      title: dto.title.trim(),
      description: dto.description,
      source: dto.source || 'MANUAL',
      priority: dto.priority || 'MEDIUM',
      status: 'OPEN',
      createdAt: now,
      updatedAt: now
    };

    const created = await this.repository.createTicket(ticket);
    return {
      success: true,
      data: created,
      metadata: this.buildMetadata()
    };
  }

  async createTicketDirect(
    title: string,
    description: string,
    source: string,
    priority: Ticket['priority'],
    workflowId?: string
  ): Promise<Ticket> {
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: `tkt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workflowId,
      title,
      description,
      source,
      priority,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now
    };
    return this.repository.createTicket(ticket);
  }

  /**
   * Creates a ticket on behalf of the platform itself (agent escalation,
   * circuit breaker, saga failure).
   *
   * This previously also accepted a legacy tenant-first argument list. That
   * overload silently shifted every parameter when a caller passed the old
   * shape, producing a ticket titled 'default' with an invalid priority — which
   * the in-memory repository tolerated but PostgreSQL rejected, so critical
   * staffing escalations were never reaching a human. The overload is gone so
   * the compiler now catches that mistake.
   */
  async createSystemTicket(
    title: string,
    description = '',
    source = 'SYSTEM',
    priority: Ticket['priority'] = 'MEDIUM',
    workflowId?: string
  ): Promise<Ticket> {
    return this.createTicketDirect(title, description, source, priority, workflowId);
  }

  async updateStatus(id: string, dto: UpdateTicketStatusDto): Promise<ApiResponse<Ticket>> {
    const ticket = await this.findTicketOrThrow(id);

    const allowed = VALID_TRANSITIONS[ticket.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid ticket status transition from [${ticket.status}] to [${dto.status}]`
      );
    }

    ticket.status = dto.status;
    if (dto.assignedTo) {
      ticket.assignedTo = dto.assignedTo;
    }
    ticket.updatedAt = new Date().toISOString();

    const updated = await this.repository.updateTicket(ticket);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async getTicket(id: string): Promise<ApiResponse<Ticket>> {
    const ticket = await this.findTicketOrThrow(id);
    return {
      success: true,
      data: ticket,
      metadata: this.buildMetadata()
    };
  }

  async listTickets(status?: string): Promise<ApiResponse<Ticket[]>> {
    const tickets = await this.repository.findAllTickets(status);
    return {
      success: true,
      data: tickets,
      metadata: this.buildMetadata()
    };
  }

  async getTicketWithDetails(id: string): Promise<ApiResponse<TicketWithDetails>> {
    return this.getTicketDetails(id);
  }

  async getTicketDetails(id: string): Promise<ApiResponse<TicketWithDetails>> {
    const ticket = await this.findTicketOrThrow(id);
    const comments = await this.repository.findCommentsByTicket(id);
    const assignments = await this.repository.findAssignmentsByTicket(id);
    const sla = (await this.repository.findSlaByTicket(id)) ?? undefined;

    return {
      success: true,
      data: {
        ...ticket,
        comments,
        assignments,
        sla
      },
      metadata: this.buildMetadata()
    };
  }

  async addComment(ticketId: string, dto: AddCommentDto): Promise<ApiResponse<TicketComment>> {
    await this.findTicketOrThrow(ticketId);

    if (!dto.authorId || !dto.body || dto.body.trim() === '') {
      throw new BadRequestException('Comment authorId and body are required');
    }

    const comment: TicketComment = {
      id: `cmnt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ticketId,
      authorId: dto.authorId,
      body: dto.body.trim(),
      createdAt: new Date().toISOString()
    };

    const created = await this.repository.addComment(comment);
    return {
      success: true,
      data: created,
      metadata: this.buildMetadata()
    };
  }

  async listComments(ticketId: string): Promise<ApiResponse<TicketComment[]>> {
    await this.findTicketOrThrow(ticketId);
    const comments = await this.repository.findCommentsByTicket(ticketId);
    return {
      success: true,
      data: comments,
      metadata: this.buildMetadata()
    };
  }

  async assignTicket(ticketId: string, dto: AssignTicketDto): Promise<ApiResponse<TicketAssignment>> {
    const ticket = await this.findTicketOrThrow(ticketId);

    if (!dto.assigneeId) {
      throw new BadRequestException('assigneeId is required');
    }

    const assignment: TicketAssignment = {
      id: `asgn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ticketId,
      assigneeId: dto.assigneeId,
      assignedBy: dto.assignedBy,
      assignedAt: new Date().toISOString()
    };

    const created = await this.repository.createAssignment(assignment);

    ticket.assignedTo = dto.assigneeId;
    if (ticket.status === 'OPEN' || ticket.status === 'TRIAGED') {
      ticket.status = 'ASSIGNED';
    }
    ticket.updatedAt = new Date().toISOString();
    await this.repository.updateTicket(ticket);

    return {
      success: true,
      data: created,
      metadata: this.buildMetadata()
    };
  }

  async listAssignments(ticketId: string): Promise<ApiResponse<TicketAssignment[]>> {
    await this.findTicketOrThrow(ticketId);
    const assignments = await this.repository.findAssignmentsByTicket(ticketId);
    return {
      success: true,
      data: assignments,
      metadata: this.buildMetadata()
    };
  }

  async attachSla(ticketId: string, dto: AttachSlaDto): Promise<ApiResponse<TicketSla>> {
    await this.findTicketOrThrow(ticketId);

    if (
      dto.responseDueInMinutes === undefined ||
      dto.resolutionDueInMinutes === undefined ||
      typeof dto.responseDueInMinutes !== 'number' ||
      typeof dto.resolutionDueInMinutes !== 'number' ||
      dto.responseDueInMinutes < 0 ||
      dto.resolutionDueInMinutes < 0
    ) {
      throw new BadRequestException(
        'Valid non-negative responseDueInMinutes and resolutionDueInMinutes are required'
      );
    }

    const existingSla = await this.repository.findSlaByTicket(ticketId);
    if (existingSla) {
      throw new BadRequestException(`SLA is already attached to ticket [${ticketId}]`);
    }

    const now = new Date();
    const responseDueAt = new Date(now.getTime() + dto.responseDueInMinutes * 60 * 1000).toISOString();
    const resolutionDueAt = new Date(
      now.getTime() + dto.resolutionDueInMinutes * 60 * 1000
    ).toISOString();

    const sla: TicketSla = {
      id: `tkt-sla-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ticketId,
      responseDueAt,
      resolutionDueAt,
      responseBreached: false,
      resolutionBreached: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    const saved = await this.repository.createSla(sla);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async recordResponse(ticketId: string): Promise<ApiResponse<TicketSla>> {
    await this.findTicketOrThrow(ticketId);

    const sla = await this.repository.findSlaByTicket(ticketId);
    if (!sla) {
      throw new NotFoundException(`SLA not found for ticket [${ticketId}]`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    sla.respondedAt = nowIso;
    sla.responseBreached = now.getTime() > new Date(sla.responseDueAt).getTime();
    sla.updatedAt = nowIso;

    const updated = await this.repository.updateSla(sla);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async recordResolution(ticketId: string): Promise<ApiResponse<TicketSla>> {
    await this.findTicketOrThrow(ticketId);

    const sla = await this.repository.findSlaByTicket(ticketId);
    if (!sla) {
      throw new NotFoundException(`SLA not found for ticket [${ticketId}]`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    sla.resolvedAt = nowIso;
    sla.resolutionBreached = now.getTime() > new Date(sla.resolutionDueAt).getTime();
    sla.updatedAt = nowIso;

    const updated = await this.repository.updateSla(sla);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async checkSlaBreaches(): Promise<ApiResponse<TicketSla[]>> {
    const slas = await this.repository.findBreachedOrPendingSlas();
    const now = new Date();
    const results: TicketSla[] = [];

    for (const sla of slas) {
      let changed = false;
      if (!sla.respondedAt && now.getTime() > new Date(sla.responseDueAt).getTime()) {
        sla.responseBreached = true;
        changed = true;
      }
      if (!sla.resolvedAt && now.getTime() > new Date(sla.resolutionDueAt).getTime()) {
        sla.resolutionBreached = true;
        changed = true;
      }
      if (changed) {
        sla.updatedAt = now.toISOString();
        await this.repository.updateSla(sla);
      }
      results.push(sla);
    }

    return {
      success: true,
      data: results,
      metadata: this.buildMetadata()
    };
  }
}
