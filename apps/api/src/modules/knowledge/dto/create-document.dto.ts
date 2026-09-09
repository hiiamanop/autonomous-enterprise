import type { KnowledgeSourceType } from '@autonomous-enterprise/contracts';

export class CreateKnowledgeDocumentDto {
  sourceType!: KnowledgeSourceType;
  title!: string;
  content!: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
