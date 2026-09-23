import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  // Diisi FE; default 'archive' bila tidak dikirim (permukaan upload dokumen saat ini khusus archive).
  @IsOptional()
  @IsString()
  @IsIn(['archive'])
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  entityType?: string = 'archive';
}
