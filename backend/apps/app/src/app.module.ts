import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule, JwtAuthGuard, LibsModule, PermissionsGuard } from '@app/libs';
import { appEnvValidationSchema } from '@app/libs/common/config/env.validation';
import { HealthController } from './controllers/health.controller';
import { AuthController } from './controllers/auth.controller';
import { UsersController } from './controllers/users.controller';
import { RolesController } from './controllers/roles.controller';
import { PermissionsController } from './controllers/permissions.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: appEnvValidationSchema }),
    LibsModule,
    AuthModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    RolesController,
    PermissionsController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}