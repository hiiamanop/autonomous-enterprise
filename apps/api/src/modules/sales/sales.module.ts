import { Module } from '@nestjs/common';
import {
  PrismaCustomerRepository,
  PrismaSalesOrderRepository,
  PrismaService
} from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { CUSTOMER_REPOSITORY } from './domain/customer.repository.interface';
import { SALES_ORDER_REPOSITORY } from './domain/sales-order.repository.interface';
import { SALES_REP_REPOSITORY } from './domain/sales-rep.repository.interface';
import { InMemoryCustomerRepository } from './infrastructure/in-memory-customer.repository';
import { InMemorySalesOrderRepository } from './infrastructure/in-memory-sales-order.repository';
import { InMemorySalesRepRepository } from './infrastructure/in-memory-sales-rep.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    { provide: SALES_REP_REPOSITORY, useClass: InMemorySalesRepRepository },
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: CUSTOMER_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaCustomerRepository(prisma)
          },
          {
            provide: SALES_ORDER_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaSalesOrderRepository(prisma)
          }
        ]
      : [
          { provide: CUSTOMER_REPOSITORY, useClass: InMemoryCustomerRepository },
          { provide: SALES_ORDER_REPOSITORY, useClass: InMemorySalesOrderRepository }
        ])
  ],
  exports: [SalesService]
})
export class SalesModule {}
