import { IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class SubscribeBillingDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  subscriptionId: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] }, { message: 'paymentProofUrl must be a valid http(s) URL' })
  @IsString()
  @MaxLength(2048)
  paymentProofUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  paymentProofName?: string;
}
