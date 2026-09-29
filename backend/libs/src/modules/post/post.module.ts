import { Module } from '@nestjs/common';
import { ImageModule } from '@app/libs/modules/image/image.module';
import { UserModule } from '@app/libs/modules/user/user.module';
import { StorageModule } from '@app/libs/integrations/storage/storage.module';
import { PostRepository } from './post.repository';
import { PostService } from './post.service';

@Module({
  imports: [ImageModule, UserModule, StorageModule],
  providers: [PostRepository, PostService],
  exports: [PostRepository, PostService],
})
export class PostModule {}
