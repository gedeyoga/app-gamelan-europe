import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CreatePublicNetworkDto, NetworkService, Public } from '@app/libs';

// API konsumen eksternal (website EGS) — publik anonim. Submit menulis langsung ke `networks`
// (`status=REQUEST`, `source=PUBLIC`); review admin lewat `GET /networks?filter[status]=REQUEST`
// + `POST /networks/:id/approve|reject`.
@Controller('network-submissions')
export class NetworkSubmissionsController {
  constructor(private readonly networkService: NetworkService) {}

  @Post()
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreatePublicNetworkDto) {
    return this.networkService.createPublicSubmission(dto);
  }
}
