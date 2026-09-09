import { Module } from '@nestjs/common';
import { PrismaTicketingRepository, PrismaService } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { TicketingController } from './ticketing.controller';
import { TicketingService } from './ticketing.service';
import { TICKETING_REPOSITORY } from './domain/ticketing.repository.interface';
import { InMemoryTicketingRepository } from './infrastructure/in-memory-ticketing.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [TicketingController],
  providers: [
    TicketingService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: TICKETING_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaTicketingRepository(prisma)
          }
        ]
      : [{ provide: TICKETING_REPOSITORY, useClass: InMemoryTicketingRepository }])
  ],
  exports: [TicketingService, TICKETING_REPOSITORY]
})
export class TicketingModule {}
