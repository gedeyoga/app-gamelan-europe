import { Module } from '@nestjs/common';
import { ArchiveModule } from '@app/libs/modules/archive/archive.module';
import { DocumentModule } from '@app/libs/modules/document/document.module';
import { ImageModule } from '@app/libs/modules/image/image.module';
import { ArchiveSubmissionRepository } from './archive-submission.repository';
import { ArchiveSubmissionService } from './archive-submission.service';

@Module({
  imports: [ArchiveModule, ImageModule, DocumentModule],
  providers: [ArchiveSubmissionRepository, ArchiveSubmissionService],
  exports: [ArchiveSubmissionRepository, ArchiveSubmissionService],
})
export class ArchiveSubmissionModule {}
