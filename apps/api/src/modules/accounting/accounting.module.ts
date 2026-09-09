import { Module } from '@nestjs/common';
import { PrismaAccountingRepository, PrismaService } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { ACCOUNTING_REPOSITORY } from './domain/accounting.repository.interface';
import { InMemoryAccountingRepository } from './infrastructure/in-memory-accounting.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [AccountingController],
  providers: [
    AccountingService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: ACCOUNTING_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaAccountingRepository(prisma)
          }
        ]
      : [{ provide: ACCOUNTING_REPOSITORY, useClass: InMemoryAccountingRepository }])
  ],
  exports: [AccountingService, ACCOUNTING_REPOSITORY]
})
export class AccountingModule {}
