import { Module } from '@nestjs/common';
import { PrismaAgentRegistryRepository, PrismaService } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { AgentRegistryController } from './agent-registry.controller';
import { AgentRegistryService } from './agent-registry.service';
import { AGENT_REGISTRY_REPOSITORY } from './domain/agent-registry.repository.interface';
import { InMemoryAgentRegistryRepository } from './infrastructure/in-memory-agent-registry.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [AgentRegistryController],
  providers: [
    AgentRegistryService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: AGENT_REGISTRY_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaAgentRegistryRepository(prisma)
          }
        ]
      : [{ provide: AGENT_REGISTRY_REPOSITORY, useClass: InMemoryAgentRegistryRepository }])
  ],
  exports: [AgentRegistryService, AGENT_REGISTRY_REPOSITORY]
})
export class AgentRegistryModule {}
