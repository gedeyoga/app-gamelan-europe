import { NetworkStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsUUID } from 'class-validator';

export class BulkUpdateNetworkStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];

  @IsEnum(NetworkStatus)
  status: NetworkStatus;
}
