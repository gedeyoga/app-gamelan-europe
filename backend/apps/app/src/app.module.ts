import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import {
  ApiKeyModule,
  ArchiveModule,
  AuthModule,
  CategoryModule,
  DocumentModule,
  EventModule,
  EventTypeModule,
  ImageModule,
  JwtAuthGuard,
  LibsModule,
  OrganizationModule,
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
import { EventsController } from './controllers/events.controller';
import { EventTypesController } from './controllers/event-types.controller';
import { ImagesController } from './controllers/images.controller';
import { ArchivesController } from './controllers/archives.controller';
import { DocumentsController } from './controllers/documents.controller';
import { OrganizationsController } from './controllers/organizations.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { BillingsController } from './controllers/billings.controller';
import { ApiKeysController } from './controllers/api-keys.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: appEnvValidationSchema }),
    LibsModule,
    AuthModule,
    ApiKeyModule,
    PostModule,
    CategoryModule,
    EventModule,
    EventTypeModule,
    ImageModule,
    StorageModule,
    ArchiveModule,
    DocumentModule,
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
    EventsController,
    EventTypesController,
    ImagesController,
    ArchivesController,
    DocumentsController,
    OrganizationsController,
    SubscriptionsController,
    BillingsController,
    ApiKeysController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}