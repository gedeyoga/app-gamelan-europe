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
  ArchiveSubmissionService,
  AuthenticatedUser,
  CreateArchiveSubmissionDto,
  CurrentUser,
  DocumentService,
  DocumentUploadInterceptor,
  ImageService,
  ListArchiveSubmissionsQueryDto,
  MulterUploadInterceptor,
  Permissions,
  Public,
  ReviewArchiveSubmissionDto,
} from '@app/libs';

@Controller('archive-submissions')
export class ArchiveSubmissionsController {
  constructor(
    private readonly archiveSubmissionService: ArchiveSubmissionService,
    private readonly imageService: ImageService,
    private readonly documentService: DocumentService,
  ) {}

  // API konsumen eksternal (website EGS) — publik anonim, respons hanya `{ id, status }`.
  @Post()
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreateArchiveSubmissionDto) {
    return this.archiveSubmissionService.create(dto);
  }

  // `entityType` di-hardcode server-side (tidak diterima dari body publik).
  @Post('thumbnail')
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(MulterUploadInterceptor)
  thumbnail(@UploadedFile() file: Express.Multer.File) {
    return this.imageService.upload(file, 'archive-submission');
  }

  // PDF-only + max `UPLOAD_DOCUMENT_MAX_SIZE_MB`; `entityType` di-hardcode server-side.
  @Post('attachments')
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(DocumentUploadInterceptor)
  attachment(@UploadedFile() file: Express.Multer.File) {
    return this.documentService.upload(file, 'archive-submission');
  }

  @Get()
  @Permissions('archive-submission:read')
  async list(@Query() query: ListArchiveSubmissionsQueryDto) {
    const { items, total } = await this.archiveSubmissionService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('archive-submission:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.archiveSubmissionService.findOne(id);
  }

  @Post(':id/approve')
  @Permissions('archive-submission:approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewArchiveSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.archiveSubmissionService.approve(id, user.id, dto);
  }

  @Post(':id/reject')
  @Permissions('archive-submission:reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewArchiveSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.archiveSubmissionService.reject(id, user.id, dto);
  }
}
