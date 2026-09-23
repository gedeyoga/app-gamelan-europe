import { Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import {
  DocumentService,
  DocumentUploadInterceptor,
  Permissions,
  UploadDocumentDto,
} from '@app/libs';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @Permissions('archive:create', 'archive:update') // ANY-of (PDF saja)
  @HttpCode(201)
  @UseInterceptors(DocumentUploadInterceptor)
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadDocumentDto) {
    return this.documentService.upload(file, dto.entityType ?? 'archive');
  }
}
