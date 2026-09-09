import { Module } from '@nestjs/common';
import { PrismaService, PrismaWorkflowTaskRepository } from '@autonomous-enterprise/database';
import { DatabaseModule } from '../../common/database/database.module';
import { TicketingModule } from '../ticketing/ticketing.module';
import { WorkflowTaskService } from './workflow-task.service';
import { WORKFLOW_TASK_REPOSITORY } from './domain/workflow-task.repository.interface';
import { InMemoryWorkflowTaskRepository } from './infrastructure/in-memory-workflow-task.repository';

@Module({
  imports: [DatabaseModule, TicketingModule],
  providers: [
    WorkflowTaskService,
    ...(process.env.DATABASE_DRIVER === 'prisma'
      ? [
          {
            provide: WORKFLOW_TASK_REPOSITORY,
            inject: [PrismaService],
            useFactory: (prisma: PrismaService) => new PrismaWorkflowTaskRepository(prisma)
          }
        ]
      : [{ provide: WORKFLOW_TASK_REPOSITORY, useClass: InMemoryWorkflowTaskRepository }])
  ],
  exports: [WorkflowTaskService]
})
export class WorkflowTaskModule {}
