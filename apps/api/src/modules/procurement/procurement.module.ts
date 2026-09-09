import { Module } from '@nestjs/common';
import { PrismaService, PrismaProcurementRepository } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { PROCUREMENT_REPOSITORY } from './domain/procurement.repository.interface';
import { InMemoryProcurementRepository } from './infrastructure/in-memory-procurement.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ProcurementController],
  providers: [
    ProcurementService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: PROCUREMENT_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaProcurementRepository(prisma)
          }
        ]
      : [{ provide: PROCUREMENT_REPOSITORY, useClass: InMemoryProcurementRepository }])
  ],
  exports: [ProcurementService, PROCUREMENT_REPOSITORY]
})
export class ProcurementModule {}
