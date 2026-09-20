import { Module } from '@nestjs/common';
import { ApiKeyRepository } from './api-key.repository';
import { ApiKeyService } from './api-key.service';

@Module({
  providers: [ApiKeyRepository, ApiKeyService],
  exports: [ApiKeyRepository, ApiKeyService],
})
export class ApiKeyModule {}
