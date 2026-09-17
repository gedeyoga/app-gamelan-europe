import { Controller, Post, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '@app/libs';

@Controller('internal/jobs')
@UseGuards(InternalAuthGuard)
export class InternalJobsController {
  @Post('process')
  process() {
    return { accepted: true };
  }
}
