import { Module } from '@nestjs/common';
import { TicketingModule } from '../../modules/ticketing/ticketing.module';
import { ConflictResolutionService } from './conflict-resolution.service';

@Module({
  imports: [TicketingModule],
  providers: [ConflictResolutionService],
  exports: [ConflictResolutionService]
})
export class OrchestrationModule {}
