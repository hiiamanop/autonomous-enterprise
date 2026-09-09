import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  ApiResponse,
  KnowledgeDocument,
  KnowledgeSearchResult,
  KnowledgeSourceType
} from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { KNOWLEDGE_REPOSITORY, type IKnowledgeRepository } from './domain/knowledge.repository.interface';
import type { CreateKnowledgeDocumentDto } from './dto/create-document.dto';
import type { UpdateKnowledgeDocumentDto } from './dto/update-document.dto';
import type { SearchDocumentsDto } from './dto/search-documents.dto';

const DEFAULT_SEARCH_LIMIT = 5;

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repository: IKnowledgeRepository
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async createDocument(dto: CreateKnowledgeDocumentDto): Promise<ApiResponse<KnowledgeDocument>> {
    if (!dto.sourceType || !dto.title || !dto.content) {
      throw new BadRequestException('sourceType, title and content are required');
    }

    const now = new Date().toISOString();
    const document: KnowledgeDocument = {
      id: randomUUID(),
      sourceType: dto.sourceType,
      title: dto.title,
      content: dto.content,
      tags: dto.tags || [],
      metadata: dto.metadata,
      createdAt: now,
      updatedAt: now
    };

    const created = await this.repository.createDocument(document);
    return {
      success: true,
      data: created,
      metadata: this.buildMetadata()
    };
  }

  async getDocument(id: string): Promise<ApiResponse<KnowledgeDocument>> {
    const document = await this.repository.findDocumentById(id);
    if (!document) {
      throw new NotFoundException(`KnowledgeDocument with ID ${id} not found`);
    }

    return {
      success: true,
      data: document,
      metadata: this.buildMetadata()
    };
  }

  async updateDocument(id: string, dto: UpdateKnowledgeDocumentDto): Promise<ApiResponse<KnowledgeDocument>> {
    const existing = await this.repository.findDocumentById(id);
    if (!existing) {
      throw new NotFoundException(`KnowledgeDocument with ID ${id} not found`);
    }

    const updatedDocument: KnowledgeDocument = {
      ...existing,
      title: dto.title ?? existing.title,
      content: dto.content ?? existing.content,
      sourceType: dto.sourceType ?? existing.sourceType,
      tags: dto.tags ?? existing.tags,
      metadata: dto.metadata ?? existing.metadata,
      updatedAt: new Date().toISOString()
    };

    const saved = await this.repository.updateDocument(updatedDocument);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async deleteDocument(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    const existing = await this.repository.findDocumentById(id);
    if (!existing) {
      throw new NotFoundException(`KnowledgeDocument with ID ${id} not found`);
    }

    await this.repository.deleteDocument(id);
    return {
      success: true,
      data: { deleted: true },
      metadata: this.buildMetadata()
    };
  }

  async retrieveEvidence(query: string): Promise<Array<{ document: KnowledgeDocument; score: number }>> {
    const response = await this.searchDocuments({ query });
    const result = response.data;
    if (!result) {
      return [];
    }
    if (result.document) {
      return [{ document: result.document, score: result.score ?? 0 }];
    }
    return (result.documents ?? []).map((document, index) => ({
      document,
      score: result.scores?.[index] ?? 0
    }));
  }

  async searchDocuments(dto: SearchDocumentsDto): Promise<ApiResponse<KnowledgeSearchResult>> {
    const query = dto.query?.trim();
    if (!query) {
      throw new BadRequestException('Search query cannot be empty');
    }

    const limit = dto.limit ?? DEFAULT_SEARCH_LIMIT;
    const documents = await this.repository.findAllDocuments(dto.sourceType);

    const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);

    const scored = documents
      .map((doc) => {
        let score = 0;
        const titleLower = doc.title.toLowerCase();
        const contentLower = doc.content.toLowerCase();

        for (const token of queryTokens) {
          if (titleLower.includes(token)) score += 0.6;
          if (contentLower.includes(token)) score += 0.3;
          if (doc.tags?.some((t) => t.toLowerCase().includes(token))) score += 0.4;
        }

        return {
          document: doc,
          score: Math.min(1.0, Number(score.toFixed(2)))
        };
      })
      .filter((item) => item.score >= (dto.minScore ?? 0.1))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      success: true,
      data: {
        query,
        documents: scored.map((s) => s.document),
        scores: scored.map((s) => s.score),
        document: scored[0]?.document,
        score: scored[0]?.score
      },
      metadata: this.buildMetadata()
    };
  }

  async listDocuments(sourceType?: KnowledgeSourceType): Promise<ApiResponse<KnowledgeDocument[]>> {
    const documents = await this.repository.findAllDocuments(sourceType);
    return {
      success: true,
      data: documents,
      metadata: this.buildMetadata()
    };
  }
}
