import type { KnowledgeSourceType } from '@autonomous-enterprise/contracts';

export class SearchDocumentsDto {
  query!: string;
  sourceType?: KnowledgeSourceType;
  limit?: number;
  minScore?: number;
}
