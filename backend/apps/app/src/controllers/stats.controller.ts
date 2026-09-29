import { Controller, Get } from '@nestjs/common';
import { Public, StatsService } from '@app/libs';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Public()
  @Get('summary')
  getSummary() {
    return this.statsService.getSummary();
  }
}
