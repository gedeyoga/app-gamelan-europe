import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '@app/libs/modules/user/user.module';
import { PermissionModule } from '@app/libs/modules/permission/permission.module';
import { ApiKeyModule } from '@app/libs/modules/api-key/api-key.module';
import { ImageModule } from '@app/libs/modules/image/image.module';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    UserModule,
    PermissionModule,
    ApiKeyModule,
    ImageModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [AuthService, RefreshTokenRepository, JwtStrategy, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, JwtStrategy, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}