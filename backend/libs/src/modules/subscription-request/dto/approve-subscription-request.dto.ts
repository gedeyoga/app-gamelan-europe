import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Body approve admin — catatan + bukti pembayaran (opsional).
export class ApproveSubscriptionRequestDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  paymentProofUrl?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  paymentProofName?: string;
}
