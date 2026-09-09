import { Module } from '@nestjs/common';
import { PrismaInventoryRepository, PrismaService } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { INVENTORY_REPOSITORY } from './domain/inventory.repository.interface';
import { InMemoryInventoryRepository } from './infrastructure/in-memory-inventory.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: INVENTORY_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaInventoryRepository(prisma)
          }
        ]
      : [{ provide: INVENTORY_REPOSITORY, useClass: InMemoryInventoryRepository }])
  ],
  exports: [InventoryService, INVENTORY_REPOSITORY]
})
export class InventoryModule {}
