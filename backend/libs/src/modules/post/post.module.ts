import { Module } from '@nestjs/common';
import { CategoryModule } from '@app/libs/modules/category/category.module';
import { CountryModule } from '@app/libs/modules/country/country.module';
import { StateModule } from '@app/libs/modules/state/state.module';
import { ImageModule } from '@app/libs/modules/image/image.module';
import { UserModule } from '@app/libs/modules/user/user.module';
import { StorageModule } from '@app/libs/integrations/storage/storage.module';
import { PostRepository } from './post.repository';
import { PostService } from './post.service';

@Module({
  imports: [CategoryModule, CountryModule, StateModule, ImageModule, UserModule, StorageModule],
  providers: [PostRepository, PostService],
  exports: [PostRepository, PostService],
})
export class PostModule {}
