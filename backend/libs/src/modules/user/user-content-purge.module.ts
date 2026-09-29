import { Module } from '@nestjs/common';
import { ArchiveModule } from '@app/libs/modules/archive/archive.module';
import { EventModule } from '@app/libs/modules/event/event.module';
import { PostModule } from '@app/libs/modules/post/post.module';
import { UserModule } from './user.module';
import { UserContentPurgeService } from './user-content-purge.service';

// Modul terpisah dari `UserModule` agar `UserModule` tidak (transitif) meng-import modul konten — mencegah cycle.
@Module({
  imports: [UserModule, PostModule, EventModule, ArchiveModule],
  providers: [UserContentPurgeService],
  exports: [UserContentPurgeService],
})
export class UserContentPurgeModule {}
