import { Injectable } from '@nestjs/common';
import type { KnowledgeDocument, KnowledgeSourceType } from '@autonomous-enterprise/contracts';
import type { IKnowledgeRepository } from '../domain/knowledge.repository.interface';

@Injectable()
export class InMemoryKnowledgeRepository implements IKnowledgeRepository {
  private readonly documents: Map<string, KnowledgeDocument> = new Map();

  async createDocument(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    this.documents.set(document.id, { ...document });
    return { ...document };
  }

  async updateDocument(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    if (!this.documents.has(document.id)) {
      throw new Error(`KnowledgeDocument with ID ${document.id} not found`);
    }
    this.documents.set(document.id, { ...document });
    return { ...document };
  }

  async findDocumentById(id: string): Promise<KnowledgeDocument | null> {
    const doc = this.documents.get(id);
    return doc ? { ...doc } : null;
  }

  async findAllDocuments(sourceType?: KnowledgeSourceType): Promise<KnowledgeDocument[]> {
    return Array.from(this.documents.values())
      .filter((d) => {
        if (sourceType && d.sourceType !== sourceType) return false;
        return true;
      })
      .map((d) => ({ ...d }));
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }
}
