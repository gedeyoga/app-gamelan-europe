import { Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ImageService, MulterUploadInterceptor, Permissions, UploadImageDto } from '@app/libs';

@Controller('images')
export class ImagesController {
  constructor(private readonly imageService: ImageService) {}

  @Post()
  @Permissions('story:create', 'story:update', 'event:create', 'event:update') // ANY-of
  @HttpCode(201)
  @UseInterceptors(MulterUploadInterceptor)
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadImageDto) {
    return this.imageService.upload(file, dto.entityType ?? 'post');
  }
}
