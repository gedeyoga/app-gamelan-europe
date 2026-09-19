import { Module } from '@nestjs/common';
import { StorageModule } from '@app/libs/integrations/storage/storage.module';
import { ImageRepository } from './image.repository';
import { ImageService } from './image.service';

@Module({
  imports: [StorageModule],
  providers: [ImageRepository, ImageService],
  exports: [ImageRepository, ImageService],
})
export class ImageModule {}
