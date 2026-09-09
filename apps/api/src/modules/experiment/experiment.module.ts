import { Module } from '@nestjs/common';
import { PrismaExperimentRepository, PrismaService } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { AiProviderModule } from '../../common/ai-provider/ai-provider.module';
import { ExperimentController } from './experiment.controller';
import { ExperimentService } from './experiment.service';
import { EXPERIMENT_REPOSITORY } from './domain/experiment.repository.interface';
import { InMemoryExperimentRepository } from './infrastructure/in-memory-experiment.repository';
import { SandboxedReplayService } from './sandboxed-replay.service';

@Module({
  imports: [DatabaseModule, AiProviderModule],
  controllers: [ExperimentController],
  providers: [
    ExperimentService,
    SandboxedReplayService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [{ provide: EXPERIMENT_REPOSITORY, inject: [PrismaService], useFactory: (prisma: PrismaService) => new PrismaExperimentRepository(prisma) }]
      : [{ provide: EXPERIMENT_REPOSITORY, useClass: InMemoryExperimentRepository }])
  ],
  exports: [ExperimentService, EXPERIMENT_REPOSITORY]
})
export class ExperimentModule {}
