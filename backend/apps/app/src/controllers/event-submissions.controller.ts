import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  AuthenticatedUser,
  CreateEventSubmissionDto,
  CurrentUser,
  EventSubmissionService,
  ImageResponse,
  ImageService,
  ListEventSubmissionsQueryDto,
  MulterUploadManyInterceptor,
  Permissions,
  Public,
  requireUploadedFiles,
  ReviewEventSubmissionDto,
} from '@app/libs';

@Controller('event-submissions')
export class EventSubmissionsController {
  constructor(
    private readonly eventSubmissionService: EventSubmissionService,
    private readonly imageService: ImageService,
  ) {}

  // API konsumen eksternal (website EGS) — publik anonim, respons hanya `{ id, status }`.
  @Post()
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreateEventSubmissionDto) {
    return this.eventSubmissionService.create(dto);
  }

  // `entityType` di-hardcode server-side (tidak diterima dari body publik).
  // Multi-file: field `files` (maks 10), respons array `ImageResponse[]`.
  @Post('thumbnail')
  @Public()
  @HttpCode(201)
  @UseInterceptors(MulterUploadManyInterceptor)
  thumbnail(@UploadedFiles() files: Express.Multer.File[]): Promise<ImageResponse[]> {
    return Promise.all(
      requireUploadedFiles(files).map((file) => this.imageService.upload(file, 'event-submission')),
    );
  }

  @Get()
  @Permissions('event-submission:read')
  async list(@Query() query: ListEventSubmissionsQueryDto) {
    const { items, total } = await this.eventSubmissionService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('event-submission:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventSubmissionService.findOne(id);
  }

  @Post(':id/approve')
  @Permissions('event-submission:approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewEventSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventSubmissionService.approve(id, user.id, dto);
  }

  @Post(':id/reject')
  @Permissions('event-submission:reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewEventSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventSubmissionService.reject(id, user.id, dto);
  }
}
