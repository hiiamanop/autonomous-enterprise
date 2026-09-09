import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { TicketingService } from './ticketing.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { AttachSlaDto } from './dto/attach-sla.dto';

@Controller('api/v1/tickets')
export class TicketingController {
  constructor(
    @Inject(TicketingService) private readonly ticketingService: TicketingService
  ) {}

  @Post()
  @HttpCode(201)
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.AI_ORCHESTRATOR,
    Role.AI_SALES_AGENT,
    Role.AI_FINANCE_AGENT,
    Role.AI_INFRA_AGENT
  )
  @RequirePermissions('ticketing:write')
  @Audit('CREATE_TICKET')
  createTicket(@Body() dto: CreateTicketDto) {
    return this.ticketingService.createTicket(dto);
  }

  @Get()
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:read')
  @Audit('LIST_TICKETS')
  listTickets(@Query('status') status?: string) {
    return this.ticketingService.listTickets(status);
  }

  @Post('sla/check-breaches')
  @HttpCode(200)
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:write')
  @Audit('CHECK_TICKET_SLA_BREACHES')
  checkSlaBreaches() {
    return this.ticketingService.checkSlaBreaches();
  }

  @Get(':id/details')
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:read')
  @Audit('GET_TICKET_WITH_DETAILS')
  getTicketWithDetails(@Param('id') id: string) {
    return this.ticketingService.getTicketWithDetails(id);
  }

  @Get(':id')
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:read')
  @Audit('GET_TICKET')
  getTicket(@Param('id') id: string) {
    return this.ticketingService.getTicket(id);
  }

  @Patch(':id/status')
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:write')
  @Audit('UPDATE_TICKET_STATUS')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.ticketingService.updateStatus(id, dto);
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.HR_MANAGER,
    Role.EMPLOYEE,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:write')
  @Audit('ADD_TICKET_COMMENT')
  addComment(@Param('id') id: string, @Body() dto: AddCommentDto) {
    return this.ticketingService.addComment(id, dto);
  }

  @Get(':id/comments')
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.HR_MANAGER,
    Role.EMPLOYEE,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:read')
  @Audit('LIST_TICKET_COMMENTS')
  listComments(@Param('id') id: string) {
    return this.ticketingService.listComments(id);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:write')
  @Audit('ASSIGN_TICKET')
  assignTicket(@Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.ticketingService.assignTicket(id, dto);
  }

  @Get(':id/assignments')
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:read')
  @Audit('LIST_TICKET_ASSIGNMENTS')
  listAssignments(@Param('id') id: string) {
    return this.ticketingService.listAssignments(id);
  }

  @Post(':id/sla')
  @HttpCode(201)
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:write')
  @Audit('ATTACH_TICKET_SLA')
  attachSla(@Param('id') id: string, @Body() dto: AttachSlaDto) {
    return this.ticketingService.attachSla(id, dto);
  }

  @Post(':id/sla/respond')
  @HttpCode(200)
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:write')
  @Audit('RECORD_TICKET_SLA_RESPONSE')
  recordResponse(@Param('id') id: string) {
    return this.ticketingService.recordResponse(id);
  }

  @Post(':id/sla/resolve')
  @HttpCode(200)
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('ticketing:write')
  @Audit('RECORD_TICKET_SLA_RESOLUTION')
  recordResolution(@Param('id') id: string) {
    return this.ticketingService.recordResolution(id);
  }
}
