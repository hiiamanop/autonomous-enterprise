import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/auth/tenant.guard';

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get('health')
  @Public()
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
