import { Module } from '@nestjs/common';
import { PrismaService, PrismaAiBudgetRepository } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { MessagingModule } from '../../common/messaging/messaging.module';
import { AiBudgetController } from './ai-budget.controller';
import { AiBudgetService } from './ai-budget.service';
import { AI_BUDGET_REPOSITORY } from './domain/ai-budget.repository.interface';
import { InMemoryAiBudgetRepository } from './infrastructure/in-memory-ai-budget.repository';

@Module({
  imports: [DatabaseModule, MessagingModule],
  controllers: [AiBudgetController],
  providers: [
    AiBudgetService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: AI_BUDGET_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaAiBudgetRepository(prisma)
          }
        ]
      : [{ provide: AI_BUDGET_REPOSITORY, useClass: InMemoryAiBudgetRepository }])
  ],
  exports: [AiBudgetService]
})
export class AiBudgetModule {}
