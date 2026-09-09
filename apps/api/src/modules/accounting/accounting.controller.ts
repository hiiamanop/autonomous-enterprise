import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query
} from '@nestjs/common';
import { Role, type JournalStatus, type InvoiceStatus } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { AccountingService } from './accounting.service';
import { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@Controller('api/v1/accounting')
export class AccountingController {
  constructor(
    @Inject(AccountingService)
    private readonly accountingService: AccountingService
  ) {}

  @Post('chart-of-accounts')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT)
  @RequirePermissions('accounting:write')
  @Audit('CREATE_CHART_OF_ACCOUNT')
  createChartOfAccount(@Body() dto: CreateChartOfAccountDto) {
    return this.accountingService.createChartOfAccount(dto);
  }

  @Get('chart-of-accounts')
  @Roles(
    Role.TENANT_ADMIN,
    Role.FINANCE_MANAGER,
    Role.ACCOUNTANT,
    Role.AI_FINANCE_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('accounting:read')
  @Audit('LIST_CHART_OF_ACCOUNTS')
  listChartOfAccounts() {
    return this.accountingService.listChartOfAccounts();
  }

  @Get('chart-of-accounts/:id')
  @Roles(
    Role.TENANT_ADMIN,
    Role.FINANCE_MANAGER,
    Role.ACCOUNTANT,
    Role.AI_FINANCE_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('accounting:read')
  @Audit('GET_CHART_OF_ACCOUNT')
  getChartOfAccount(@Param('id') id: string) {
    return this.accountingService.getChartOfAccount(id);
  }

  @Post('journals')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT, Role.AI_FINANCE_AGENT)
  @RequirePermissions('accounting:write')
  @Audit('CREATE_JOURNAL')
  createJournal(@Body() dto: CreateJournalDto) {
    return this.accountingService.createJournal(dto);
  }

  @Get('journals')
  @Roles(
    Role.TENANT_ADMIN,
    Role.FINANCE_MANAGER,
    Role.ACCOUNTANT,
    Role.AI_FINANCE_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('accounting:read')
  @Audit('LIST_JOURNALS')
  listJournals(@Query('status') status?: JournalStatus) {
    return this.accountingService.listJournals(status);
  }

  @Get('journals/:id')
  @Roles(
    Role.TENANT_ADMIN,
    Role.FINANCE_MANAGER,
    Role.ACCOUNTANT,
    Role.AI_FINANCE_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('accounting:read')
  @Audit('GET_JOURNAL')
  getJournal(@Param('id') id: string) {
    return this.accountingService.getJournal(id);
  }

  @Post('journals/:id/post')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT)
  @RequirePermissions('accounting:post')
  @Audit('POST_JOURNAL')
  postJournal(@Param('id') id: string) {
    return this.accountingService.postJournal(id);
  }

  @Post('journals/:id/reverse')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT)
  @RequirePermissions('accounting:post')
  @Audit('REVERSE_JOURNAL')
  reverseJournal(@Param('id') id: string) {
    return this.accountingService.reverseJournal(id);
  }

  @Post('invoices')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT, Role.AI_FINANCE_AGENT)
  @RequirePermissions('accounting:write')
  @Audit('CREATE_INVOICE')
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.accountingService.createInvoice(dto);
  }

  @Get('invoices')
  @Roles(
    Role.TENANT_ADMIN,
    Role.FINANCE_MANAGER,
    Role.ACCOUNTANT,
    Role.AI_FINANCE_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('accounting:read')
  @Audit('LIST_INVOICES')
  listInvoices(@Query('status') status?: InvoiceStatus) {
    return this.accountingService.listInvoices(status);
  }

  @Get('invoices/:id')
  @Roles(
    Role.TENANT_ADMIN,
    Role.FINANCE_MANAGER,
    Role.ACCOUNTANT,
    Role.AI_FINANCE_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('accounting:read')
  @Audit('GET_INVOICE')
  getInvoice(@Param('id') id: string) {
    return this.accountingService.getInvoice(id);
  }

  @Post('invoices/:id/issue')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT)
  @RequirePermissions('accounting:write')
  @Audit('ISSUE_INVOICE')
  issueInvoice(@Param('id') id: string) {
    return this.accountingService.issueInvoice(id);
  }

  @Post('payments')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT)
  @RequirePermissions('accounting:write')
  @Audit('RECORD_PAYMENT')
  recordPayment(@Body() dto: RecordPaymentDto) {
    return this.accountingService.recordPayment(dto);
  }

  @Get('payments')
  @Roles(
    Role.TENANT_ADMIN,
    Role.FINANCE_MANAGER,
    Role.ACCOUNTANT,
    Role.AI_FINANCE_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('accounting:read')
  @Audit('LIST_PAYMENTS')
  listPayments(@Query('invoiceId') invoiceId?: string) {
    return this.accountingService.listPayments(invoiceId);
  }
}
