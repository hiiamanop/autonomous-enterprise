import { Module } from '@nestjs/common';
import { PrismaService } from '@autonomous-enterprise/database';

const databaseProviders =
  process.env.DATABASE_DRIVER === 'prisma' ? [PrismaService] : [];

@Module({
  providers: databaseProviders,
  exports: databaseProviders
})
export class DatabaseModule {}
