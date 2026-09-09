import type { KnowledgeDocument, KnowledgeSourceType } from '@autonomous-enterprise/contracts';

export interface IKnowledgeRepository {
  createDocument(document: KnowledgeDocument): Promise<KnowledgeDocument>;
  updateDocument(document: KnowledgeDocument): Promise<KnowledgeDocument>;
  findDocumentById(id: string): Promise<KnowledgeDocument | null>;
  findAllDocuments(sourceType?: KnowledgeSourceType): Promise<KnowledgeDocument[]>;
  deleteDocument(id: string): Promise<void>;
}

export const KNOWLEDGE_REPOSITORY = 'KNOWLEDGE_REPOSITORY';
