import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
const compression = require('compression');
import { HttpExceptionFilter, ResponseInterceptor } from '@app/libs';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(compression());

  // Express default JSON limit (~100kb) menolak 413 sebelum validasi, padahal
  // `CreatePublicPostDto.content` mengiklankan @MaxLength(100000). Naikkan
  // limit json (hanya JSON; multipart/urlencoded tak terpengaruh). Parser ini
  // didaftarkan sebelum parser default Nest → yang menang.
  app.useBodyParser('json', { limit: '1mb' });

  // Di belakang reverse proxy: pakai X-Forwarded-For agar throttle per-IP melihat IP klien asli.
  app.set('trust proxy', 1);

  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!corsOrigins?.length && process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGINS is required in production');
  }

  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: false,
  });

  app.set('query parser', 'extended');
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(Number(process.env.API_PORT ?? 3001));
}

bootstrap();
