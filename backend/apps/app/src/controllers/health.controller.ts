import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/libs';

@Controller('health')
export class HealthController {
  // PUBLIC: no authentication required.
  @Public()
  @Get()
  health() {
    return { status: 'ok' };
  }
}