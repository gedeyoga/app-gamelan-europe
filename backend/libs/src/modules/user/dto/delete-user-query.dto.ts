import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class DeleteUserQueryDto {
  // FE mengirim `?cascadeContent=true` (string). Absen → undefined (jalur delete default).
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true'))
  @IsOptional()
  @IsBoolean()
  cascadeContent?: boolean;
}
