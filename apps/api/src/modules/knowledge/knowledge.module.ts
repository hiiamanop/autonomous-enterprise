import { Module } from '@nestjs/common';
import { PrismaKnowledgeRepository, PrismaService } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KNOWLEDGE_REPOSITORY } from './domain/knowledge.repository.interface';
import { InMemoryKnowledgeRepository } from './infrastructure/in-memory-knowledge.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: KNOWLEDGE_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaKnowledgeRepository(prisma)
          }
        ]
      : [{ provide: KNOWLEDGE_REPOSITORY, useClass: InMemoryKnowledgeRepository }])
  ],
  exports: [KnowledgeService, KNOWLEDGE_REPOSITORY]
})
export class KnowledgeModule {}
