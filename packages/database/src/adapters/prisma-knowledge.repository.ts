import type {
  PrismaClient,
  KnowledgeDocument as PrismaKnowledgeDocument,
  KnowledgeSourceType as PrismaKnowledgeSourceType
} from '@prisma/client';

export type KnowledgeSourceTypeEnum =
  | 'SOP'
  | 'COMPANY_POLICY'
  | 'PRODUCT_CATALOG'
  | 'FINANCIAL_POLICY'
  | 'HR_POLICY'
  | 'PROCUREMENT_POLICY'
  | 'TECHNICAL_DOCUMENTATION'
  | 'HISTORICAL_CASE';

export interface KnowledgeDocumentEntity {
  id: string;
  sourceType: KnowledgeSourceTypeEnum;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IKnowledgeRepository {
  createDocument(document: KnowledgeDocumentEntity): Promise<KnowledgeDocumentEntity>;
  updateDocument(document: KnowledgeDocumentEntity): Promise<KnowledgeDocumentEntity>;
  findDocumentById(id: string): Promise<KnowledgeDocumentEntity | null>;
  findAllDocuments(sourceType?: KnowledgeSourceTypeEnum): Promise<KnowledgeDocumentEntity[]>;
  deleteDocument(id: string): Promise<void>;
}

export class PrismaKnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapDocument(raw: PrismaKnowledgeDocument): KnowledgeDocumentEntity {
    return {
      id: raw.id,
      sourceType: raw.sourceType as KnowledgeSourceTypeEnum,
      title: raw.title,
      content: raw.content,
      tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async createDocument(document: KnowledgeDocumentEntity): Promise<KnowledgeDocumentEntity> {
    const raw = await this.prisma.knowledgeDocument.create({
      data: {
        id: document.id,
        sourceType: document.sourceType as PrismaKnowledgeSourceType,
        title: document.title,
        content: document.content,
        tags: document.tags,
        createdAt: new Date(document.createdAt),
        updatedAt: new Date(document.updatedAt)
      }
    });

    return this.mapDocument(raw);
  }

  async updateDocument(document: KnowledgeDocumentEntity): Promise<KnowledgeDocumentEntity> {
    const raw = await this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        sourceType: document.sourceType as PrismaKnowledgeSourceType,
        title: document.title,
        content: document.content,
        tags: document.tags,
        updatedAt: new Date()
      }
    });

    return this.mapDocument(raw);
  }

  async findDocumentById(id: string): Promise<KnowledgeDocumentEntity | null> {
    const raw = await this.prisma.knowledgeDocument.findUnique({
      where: { id }
    });

    return raw ? this.mapDocument(raw) : null;
  }

  async findAllDocuments(sourceType?: KnowledgeSourceTypeEnum): Promise<KnowledgeDocumentEntity[]> {
    const list = await this.prisma.knowledgeDocument.findMany({
      where: {
        sourceType: sourceType ? (sourceType as PrismaKnowledgeSourceType) : undefined
      },
      orderBy: { createdAt: 'desc' }
    });

    return list.map((doc) => this.mapDocument(doc));
  }

  async deleteDocument(id: string): Promise<void> {
    await this.prisma.knowledgeDocument.delete({
      where: { id }
    });
  }
}
