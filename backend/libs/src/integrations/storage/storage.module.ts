import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ImageProcessor } from './image-processor';

@Global()
@Module({
  providers: [StorageService, ImageProcessor],
  exports: [StorageService, ImageProcessor],
})
export class StorageModule {}
