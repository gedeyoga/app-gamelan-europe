import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  ApiKeyModule,
  ArchiveModule,
  ArchiveSubmissionModule,
  AuthModule,
  CategoryModule,
  DocumentModule,
  EventModule,
  EventTypeModule,
  EventSubmissionModule,
  ImageModule,
  JwtAuthGuard,
  LibsModule,
  NetworkModule,
  PermissionsGuard,
  PostModule,
  StorageModule,
  StorySubmissionModule,
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
import { EventSubmissionsController } from './controllers/event-submissions.controller';
import { ArchiveSubmissionsController } from './controllers/archive-submissions.controller';
import { StorySubmissionsController } from './controllers/story-submissions.controller';
import { ImagesController } from './controllers/images.controller';
import { ArchivesController } from './controllers/archives.controller';
import { DocumentsController } from './controllers/documents.controller';
import { NetworksController } from './controllers/networks.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { BillingsController } from './controllers/billings.controller';
import { ApiKeysController } from './controllers/api-keys.controller';
import { StatsController } from './controllers/stats.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: appEnvValidationSchema }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LibsModule,
    AuthModule,
    ApiKeyModule,
    PostModule,
    CategoryModule,
    EventModule,
    EventTypeModule,
    EventSubmissionModule,
    ArchiveSubmissionModule,
    StorySubmissionModule,
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
    EventSubmissionsController,
    ArchiveSubmissionsController,
    StorySubmissionsController,
    ImagesController,
    ArchivesController,
    DocumentsController,
    NetworksController,
    SubscriptionsController,
    BillingsController,
    ApiKeysController,
    StatsController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}