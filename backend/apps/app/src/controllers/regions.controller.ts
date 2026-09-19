import { Controller, Get } from '@nestjs/common';
import { Public, RegionService } from '@app/libs';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regionService: RegionService) {}

  @Public()
  @Get()
  list() {
    return this.regionService.findMany();
  }
}
