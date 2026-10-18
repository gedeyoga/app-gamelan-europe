import { IsBoolean, IsISO8601, IsOptional } from 'class-validator';

// Body opsional untuk aksi `approve`/`publish`: tentukan tanggal terbit.
// Bila kosong → pakai `publishedAt` existing, else now (server-managed).
export class PublishContentDto {
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  // Checkbox FE "Notify members by email"; default true.
  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}
