import { Module } from '@nestjs/common';
import { PrismaFinanceRepository, PrismaService } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FINANCE_REPOSITORY } from './domain/finance.repository.interface';
import { InMemoryFinanceRepository } from './infrastructure/in-memory-finance.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: FINANCE_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaFinanceRepository(prisma)
          }
        ]
      : [{ provide: FINANCE_REPOSITORY, useClass: InMemoryFinanceRepository }])
  ],
  exports: [FinanceService, FINANCE_REPOSITORY]
})
export class FinanceModule {}
