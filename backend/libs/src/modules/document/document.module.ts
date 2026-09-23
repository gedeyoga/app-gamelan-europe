import { Module } from '@nestjs/common';
import { StorageModule } from '@app/libs/integrations/storage/storage.module';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

@Module({
  imports: [StorageModule],
  providers: [DocumentRepository, DocumentService],
  exports: [DocumentRepository, DocumentService],
})
export class DocumentModule {}
