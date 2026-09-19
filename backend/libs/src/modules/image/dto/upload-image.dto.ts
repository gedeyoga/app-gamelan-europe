import { IsIn, IsOptional } from 'class-validator';

export class UploadImageDto {
  // File binary ditangani FileInterceptor + @UploadedFile() (Multer memory storage).
  @IsOptional()
  @IsIn(['post'])
  entityType?: string = 'post';
}
