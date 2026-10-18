import { Module } from '@nestjs/common';
import { CategoryModule } from '@app/libs/modules/category/category.module';
import { CountryModule } from '@app/libs/modules/country/country.module';
import { DocumentModule } from '@app/libs/modules/document/document.module';
import { ImageModule } from '@app/libs/modules/image/image.module';
import { StateModule } from '@app/libs/modules/state/state.module';
import { UserModule } from '@app/libs/modules/user/user.module';
import { StorageModule } from '@app/libs/integrations/storage/storage.module';
import { ArchiveRepository } from './archive.repository';
import { ArchiveService } from './archive.service';
import { NotificationModule } from '@app/libs/modules/notification/notification.module';

@Module({
  imports: [CategoryModule, CountryModule, DocumentModule, ImageModule, StateModule, UserModule, StorageModule, NotificationModule],
  providers: [ArchiveRepository, ArchiveService],
  exports: [ArchiveRepository, ArchiveService],
})
export class ArchiveModule {}
