import { Module } from '@nestjs/common';
import { CategoryModule } from '@app/libs/modules/category/category.module';
import { DocumentModule } from '@app/libs/modules/document/document.module';
import { StorageModule } from '@app/libs/integrations/storage/storage.module';
import { ArchiveRepository } from './archive.repository';
import { ArchiveService } from './archive.service';

@Module({
  imports: [CategoryModule, DocumentModule, StorageModule],
  providers: [ArchiveRepository, ArchiveService],
  exports: [ArchiveRepository, ArchiveService],
})
export class ArchiveModule {}
