import { IsIn, IsOptional } from 'class-validator';

export class UploadImageDto {
  // File binary ditangani FileInterceptor + @UploadedFile() (Multer memory storage).
  @IsOptional()
  @IsIn(['post', 'event', 'event-submission', 'archive-submission', 'story-submission'])
  entityType?: string = 'post';
}
