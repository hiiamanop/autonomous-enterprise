import { Module } from '@nestjs/common';
import { PrismaInfrastructureRepository, PrismaService } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { PolicyModule } from '../../common/policy/policy.module';
import { FinanceModule } from '../finance/finance.module';
import { OrchestrationModule } from '../../common/orchestration/orchestration.module';
import { InfrastructureController } from './infrastructure.controller';
import { InfrastructureService } from './infrastructure.service';
import { KubernetesClientService } from './k8s/kubernetes-client.service';
import { INFRASTRUCTURE_REPOSITORY } from './domain/infrastructure.repository.interface';
import { InMemoryInfrastructureRepository } from './infrastructure/in-memory-infrastructure.repository';

@Module({
  imports: [DatabaseModule, PolicyModule, FinanceModule, OrchestrationModule],
  controllers: [InfrastructureController],
  providers: [
    InfrastructureService,
    KubernetesClientService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: INFRASTRUCTURE_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaInfrastructureRepository(prisma)
          }
        ]
      : [{ provide: INFRASTRUCTURE_REPOSITORY, useClass: InMemoryInfrastructureRepository }])
  ],
  exports: [InfrastructureService, INFRASTRUCTURE_REPOSITORY]
})
export class InfrastructureModule {}
