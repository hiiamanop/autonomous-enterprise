import { Global, Module } from '@nestjs/common';
import { EventStreamController } from './event-stream.controller';
import { EventStreamService } from './event-stream.service';

// Global so AuditService — itself global — can optionally inject it and
// broadcast every audited action without each feature module having to import
// the event stream explicitly.
@Global()
@Module({
  controllers: [EventStreamController],
  providers: [EventStreamService],
  exports: [EventStreamService]
})
export class EventStreamModule {}
