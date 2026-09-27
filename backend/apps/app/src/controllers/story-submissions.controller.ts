import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  AuthenticatedUser,
  CreateStorySubmissionDto,
  CurrentUser,
  ImageService,
  ListStorySubmissionsQueryDto,
  MulterUploadInterceptor,
  Permissions,
  Public,
  ReviewStorySubmissionDto,
  StorySubmissionService,
} from '@app/libs';

@Controller('story-submissions')
export class StorySubmissionsController {
  constructor(
    private readonly storySubmissionService: StorySubmissionService,
    private readonly imageService: ImageService,
  ) {}

  // API konsumen eksternal (website EGS) — publik anonim, respons hanya `{ id, status }`.
  @Post()
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreateStorySubmissionDto) {
    return this.storySubmissionService.create(dto);
  }

  // `entityType` di-hardcode server-side (tidak diterima dari body publik).
  @Post('thumbnail')
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(MulterUploadInterceptor)
  thumbnail(@UploadedFile() file: Express.Multer.File) {
    return this.imageService.upload(file, 'story-submission');
  }

  // Upload galeri/flyer form publik; `entityType` di-hardcode server-side.
  @Post('images')
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(MulterUploadInterceptor)
  image(@UploadedFile() file: Express.Multer.File) {
    return this.imageService.upload(file, 'story-submission');
  }

  // Kategori STORY untuk form publik (tanpa auth). Harus di atas `:id`.
  @Get('categories')
  @Public()
  async categories() {
    const { items, total } = await this.storySubmissionService.listCategories();
    return { data: items, meta: { page: 1, limit: 100, total } };
  }

  @Get()
  @Permissions('story-submission:read')
  async list(@Query() query: ListStorySubmissionsQueryDto) {
    const { items, total } = await this.storySubmissionService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('story-submission:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.storySubmissionService.findOne(id);
  }

  @Post(':id/approve')
  @Permissions('story-submission:approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewStorySubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.storySubmissionService.approve(id, user.id, dto);
  }

  @Post(':id/reject')
  @Permissions('story-submission:reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewStorySubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.storySubmissionService.reject(id, user.id, dto);
  }
}
