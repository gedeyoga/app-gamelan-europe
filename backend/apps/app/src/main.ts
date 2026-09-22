import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
const compression = require('compression');
import { HttpExceptionFilter, ResponseInterceptor } from '@app/libs';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(compression());

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
