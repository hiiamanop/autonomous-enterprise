import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeDocumentDto } from './dto/create-document.dto';
import { UpdateKnowledgeDocumentDto } from './dto/update-document.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';

@Controller('api/v1/knowledge')
export class KnowledgeController {
  constructor(
    @Inject(KnowledgeService) private readonly knowledgeService: KnowledgeService
  ) {}

  @Post('documents')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.HR_MANAGER, Role.FINANCE_MANAGER, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('knowledge:write')
  @Audit('CREATE_KNOWLEDGE_DOCUMENT')
  createDocument(@Body() dto: CreateKnowledgeDocumentDto) {
    return this.knowledgeService.createDocument(dto);
  }

  @Put('documents/:id')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.HR_MANAGER, Role.FINANCE_MANAGER, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('knowledge:write')
  @Audit('UPDATE_KNOWLEDGE_DOCUMENT')
  updateDocument(@Param('id') id: string, @Body() dto: UpdateKnowledgeDocumentDto) {
    return this.knowledgeService.updateDocument(id, dto);
  }

  @Get('documents/:id')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AUDITOR, Role.AI_ORCHESTRATOR, Role.HR_MANAGER, Role.FINANCE_MANAGER, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('knowledge:read')
  @Audit('GET_KNOWLEDGE_DOCUMENT')
  getDocument(@Param('id') id: string) {
    return this.knowledgeService.getDocument(id);
  }

  @Get('documents')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AUDITOR, Role.AI_ORCHESTRATOR, Role.HR_MANAGER, Role.FINANCE_MANAGER, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('knowledge:read')
  @Audit('LIST_KNOWLEDGE_DOCUMENTS')
  listDocuments(@Query('sourceType') sourceType?: any) {
    return this.knowledgeService.listDocuments(sourceType);
  }

  @Delete('documents/:id')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('knowledge:write')
  @Audit('DELETE_KNOWLEDGE_DOCUMENT')
  deleteDocument(@Param('id') id: string) {
    return this.knowledgeService.deleteDocument(id);
  }

  @Post('search')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AUDITOR, Role.AI_ORCHESTRATOR, Role.HR_MANAGER, Role.FINANCE_MANAGER, Role.PROCUREMENT_MANAGER)
  @RequirePermissions('knowledge:read')
  @Audit('SEARCH_KNOWLEDGE')
  search(@Body() dto: SearchDocumentsDto) {
    return this.knowledgeService.searchDocuments(dto);
  }
}
