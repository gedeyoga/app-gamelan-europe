import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import {
  AuthModule,
  CategoryModule,
  ImageModule,
  JwtAuthGuard,
  LibsModule,
  PermissionsGuard,
  PostModule,
  StorageModule,
} from '@app/libs';
import { appEnvValidationSchema } from '@app/libs/common/config/env.validation';
import { HealthController } from './controllers/health.controller';
import { AuthController } from './controllers/auth.controller';
import { UsersController } from './controllers/users.controller';
import { RolesController } from './controllers/roles.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { RegionsController } from './controllers/regions.controller';
import { CountriesController } from './controllers/countries.controller';
import { StatesController } from './controllers/states.controller';
import { PostsController } from './controllers/posts.controller';
import { CategoriesController } from './controllers/categories.controller';
import { ImagesController } from './controllers/images.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: appEnvValidationSchema }),
    LibsModule,
    AuthModule,
    PostModule,
    CategoryModule,
    ImageModule,
    StorageModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    RolesController,
    PermissionsController,
    RegionsController,
    CountriesController,
    StatesController,
    PostsController,
    CategoriesController,
    ImagesController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}