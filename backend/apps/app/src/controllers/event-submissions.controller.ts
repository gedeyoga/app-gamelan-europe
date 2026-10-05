import { Body, Controller, HttpCode, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  CreatePublicEventDto,
  EventService,
  ImageResponse,
  ImageService,
  MulterUploadManyInterceptor,
  Public,
  requireUploadedFiles,
} from '@app/libs';

// API konsumen eksternal (website EGS) — publik anonim. Route dipertahankan sama;
// submit menulis langsung ke `events` (`status=REQUEST`, `source=PUBLIC`).
@Controller('event-submissions')
export class EventSubmissionsController {
  constructor(
    private readonly eventService: EventService,
    private readonly imageService: ImageService,
  ) {}

  @Post()
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreatePublicEventDto) {
    return this.eventService.createPublicSubmission(dto);
  }

  // `entityType` di-hardcode server-side (tidak diterima dari body publik). Field multipart `files` (maks 10), respons `ImageResponse[]`.
  @Post('thumbnail')
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(MulterUploadManyInterceptor)
  thumbnail(@UploadedFiles() files: Express.Multer.File[]): Promise<ImageResponse[]> {
    return Promise.all(requireUploadedFiles(files).map((file) => this.imageService.upload(file, 'event')));
  }
}
