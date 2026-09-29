import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  AuthService,
  ChangePasswordDto,
  CurrentUser,
  LoginDto,
  LogoutDto,
  MulterUploadInterceptor,
  Public,
  RefreshTokenDto,
  RegisterUserDto,
  UpdateProfileDto,
} from '@app/libs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterUserDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  // LOGIN-only exception: requires valid JWT, no specific permission required.
  @Post('logout')
  async logout(@Body() dto: LogoutDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user, dto.refreshToken);
  }

  // LOGIN-only exception: requires valid JWT, no specific permission required.
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  // LOGIN-only: self-service profile update.
  @Patch('me')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  // LOGIN-only: self-service avatar upload. Binds the image to the caller; response = me() profile.
  @Post('me/avatar')
  @HttpCode(200)
  @UseInterceptors(MulterUploadInterceptor)
  updateAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.authService.updateAvatar(user.id, file);
  }

  // LOGIN-only: self-service password change. Revokes all refresh tokens for the user.
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, dto);
    return null;
  }
}