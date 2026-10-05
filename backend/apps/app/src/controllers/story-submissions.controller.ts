import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  CreatePublicPostDto,
  ImageResponse,
  ImageService,
  MulterUploadManyInterceptor,
  PostService,
  Public,
  requireUploadedFiles,
} from '@app/libs';

// API konsumen eksternal (website EGS) — publik anonim. Route dipertahankan sama;
// submit menulis langsung ke `posts` (`status=REQUEST`, `source=PUBLIC`).
@Controller('story-submissions')
export class StorySubmissionsController {
  constructor(
    private readonly postService: PostService,
    private readonly imageService: ImageService,
  ) {}

  @Post()
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreatePublicPostDto) {
    return this.postService.createPublicSubmission(dto);
  }

  // `entityType` di-hardcode server-side (tidak diterima dari body publik). Field multipart `files` (maks 10), respons `ImageResponse[]`.
  @Post('thumbnail')
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(MulterUploadManyInterceptor)
  thumbnail(@UploadedFiles() files: Express.Multer.File[]): Promise<ImageResponse[]> {
    return Promise.all(requireUploadedFiles(files).map((file) => this.imageService.upload(file, 'post')));
  }

  // Upload galeri/flyer form publik; multi-file (field `files`, maks 10), respons `ImageResponse[]`.
  @Post('images')
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(MulterUploadManyInterceptor)
  image(@UploadedFiles() files: Express.Multer.File[]): Promise<ImageResponse[]> {
    return Promise.all(requireUploadedFiles(files).map((file) => this.imageService.upload(file, 'post')));
  }

  // Kategori STORY untuk form publik (tanpa auth).
  @Get('categories')
  @Public()
  async categories() {
    const { items, total } = await this.postService.listStoryCategories();
    return { data: items, meta: { page: 1, limit: 100, total } };
  }
}
