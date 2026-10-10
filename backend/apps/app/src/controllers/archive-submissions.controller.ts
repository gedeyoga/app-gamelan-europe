import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ArchiveService,
  CreatePublicArchiveDto,
  DocumentService,
  DocumentUploadInterceptor,
  ImageService,
  MulterUploadInterceptor,
  Public,
} from '@app/libs';

// API konsumen eksternal (website EGS) — publik anonim. Submit menulis langsung ke `archives`
// (`status=REQUEST`, `source=PUBLIC`, `type=PUBLIC`); review admin lewat `GET /archives` + approve/reject.
@Controller('archive-submissions')
export class ArchiveSubmissionsController {
  constructor(
    private readonly archiveService: ArchiveService,
    private readonly imageService: ImageService,
    private readonly documentService: DocumentService,
  ) {}

  @Post()
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreatePublicArchiveDto) {
    return this.archiveService.createPublicSubmission(dto);
  }

  // `entityType` di-hardcode server-side (tidak diterima dari body publik).
  @Post('thumbnail')
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(MulterUploadInterceptor)
  thumbnail(@UploadedFile() file: Express.Multer.File) {
    return this.imageService.upload(file, 'archive');
  }

  // PDF-only + max `UPLOAD_DOCUMENT_MAX_SIZE_MB`; `entityType` di-hardcode server-side.
  @Post('attachments')
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(DocumentUploadInterceptor)
  attachment(@UploadedFile() file: Express.Multer.File) {
    return this.documentService.upload(file, 'archive');
  }
}
