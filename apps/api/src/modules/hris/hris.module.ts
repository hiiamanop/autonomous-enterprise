import { Module } from '@nestjs/common';
import { PrismaHrisRepository, PrismaService } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { HrisController } from './hris.controller';
import { HrisService } from './hris.service';
import { HRIS_REPOSITORY } from './domain/hris.repository.interface';
import { DELIVERY_REPOSITORY } from './domain/delivery.repository.interface';
import { InMemoryHrisRepository } from './infrastructure/in-memory-hris.repository';
import { InMemoryDeliveryRepository } from './infrastructure/in-memory-delivery.repository';
import { TicketingModule } from '../ticketing/ticketing.module';

@Module({
  imports: [DatabaseModule, TicketingModule],
  controllers: [HrisController],
  providers: [
    HrisService,
    { provide: DELIVERY_REPOSITORY, useClass: InMemoryDeliveryRepository },
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: HRIS_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaHrisRepository(prisma)
          }
        ]
      : [{ provide: HRIS_REPOSITORY, useClass: InMemoryHrisRepository }])
  ],
  exports: [HrisService, HRIS_REPOSITORY]
})
export class HrisModule {}
