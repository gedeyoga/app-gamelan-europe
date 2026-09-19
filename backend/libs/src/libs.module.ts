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
import { RegionModule } from './modules/region/region.module';
import { CountryModule } from './modules/country/country.module';
import { StateModule } from './modules/state/state.module';
import { StorageModule } from './integrations/storage/storage.module';
import { CategoryModule } from './modules/category/category.module';
import { ImageModule } from './modules/image/image.module';
import { PostModule } from './modules/post/post.module';

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
  imports: [
    UserModule,
    RoleModule,
    PermissionModule,
    RolePermissionModule,
    RegionModule,
    CountryModule,
    StateModule,
    StorageModule,
    CategoryModule,
    ImageModule,
    PostModule,
  ],
  providers: [redisProvider, PrismaService, CacheService, InternalAuthGuard],
  exports: [
    PrismaService,
    CacheService,
    InternalAuthGuard,
    UserModule,
    RoleModule,
    PermissionModule,
    RolePermissionModule,
    RegionModule,
    CountryModule,
    StateModule,
    StorageModule,
    CategoryModule,
    ImageModule,
    PostModule,
  ],
})
export class LibsModule {}