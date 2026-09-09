import { Module } from '@nestjs/common';
import { ModelRoutingService } from './model-routing.service';
import { OmniRouterClient } from './omnirouter.client';
import { RateLimitSupervisorService } from './rate-limit-supervisor.service';

@Module({
  providers: [ModelRoutingService, OmniRouterClient, RateLimitSupervisorService],
  exports: [ModelRoutingService, OmniRouterClient, RateLimitSupervisorService]
})
export class AiProviderModule {}
