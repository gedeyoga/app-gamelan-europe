import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from './core/database/prisma.service';
import { CacheService, REDIS_CLIENT } from './core/redis/cache.service';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionModule } from './modules/permission/permission.module';
import { RolePermissionModule } from './modules/role-permissions/role-permission.module';

const redisProvider = {
  provide: REDIS_CLIENT,
  useFactory: (config: ConfigService) =>
    new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      lazyConnect: true,
    }),
  inject: [ConfigService],
};

@Global()
@Module({
  imports: [UserModule, RoleModule, PermissionModule, RolePermissionModule],
  providers: [redisProvider, PrismaService, CacheService, InternalAuthGuard],
  exports: [
    PrismaService,
    CacheService,
    InternalAuthGuard,
    UserModule,
    RoleModule,
    PermissionModule,
    RolePermissionModule,
  ],
})
export class LibsModule {}