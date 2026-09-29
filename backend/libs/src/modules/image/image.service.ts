import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { ImageProcessor } from '@app/libs/integrations/storage/image-processor';
import { ImageRepository } from './image.repository';
import { ImageEntity, ImageVariant } from './entities/image.entity';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface ImageResponse {
  id: string;
  url: string;
  key: string;
  filename: string;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  variants: (ImageVariant & { url: string })[];
}

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly imageProcessor: ImageProcessor,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  private invalid(message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field: 'file', message }],
    });
  }

  private toImageUrl(key: string): string {
    const base = this.config.getOrThrow<string>('S3_PUBLIC_BASE_URL').replace(/\/+$/, '');
    return `${base}/${key}`;
  }

  toImageResponse(image: ImageEntity): ImageResponse {
    const variants = (image.variants as unknown as ImageVariant[] | null) ?? [];
    const large = variants.find((v) => v.name === 'large');
    return {
      id: image.id,
      url: this.toImageUrl(large?.key ?? image.key),
      key: image.key,
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.size,
      width: image.width,
      height: image.height,
      variants: variants.map((v) => ({ ...v, url: this.toImageUrl(v.key) })),
    };
  }

  // Trust check thumbnail submission (§8.4): URL harus prefix S3_PUBLIC_BASE_URL DAN
  // menunjuk key milik row Image (entityType cocok, entityId null = belum ditautkan).
  // Lookup terarah via uuid di key → PK, bukan scan seluruh row tipe.
  async isTrustedUnboundUrl(url: string, entityType: string): Promise<boolean> {
    const base = this.config.getOrThrow<string>('S3_PUBLIC_BASE_URL').replace(/\/+$/, '');
    const prefix = `${base}/`;
    if (!url.startsWith(prefix)) return false;
    const key = url.slice(prefix.length);
    if (!key) return false;
    const id = UUID_RE.exec(key)?.[0];
    if (!id) return false;
    const image = await this.imageRepository.findUnboundById(id, entityType);
    if (!image) return false;
    const variants = (image.variants as unknown as ImageVariant[] | null) ?? [];
    return image.key === key || variants.some((v) => v.key === key);
  }

  // Hapus row milik entity + objek S3 (best-effort, DB dulu). Dipakai avatar replace/clear.
  async removeByEntity(entityType: string, entityId: string): Promise<void> {
    const keys = await this.imageRepository.deleteByEntity(entityType, entityId);
    try {
      await this.storage.deleteObjects(keys);
    } catch {
      this.logger.warn(`S3 cleanup failed for ${entityType} ${entityId} (${keys.length} object(s)); continuing`);
    }
  }

  // Bind baris upload (unbound) ke entity; ownership `createdBy` ditegakkan di repository.
  async bindToOwner(id: string, entityType: string, entityId: string, createdBy: string): Promise<void> {
    const count = await this.imageRepository.bindOwnedById(id, entityType, entityId, createdBy);
    if (count !== 1) throw this.invalid('image could not be bound');
  }

  async upload(
    file: Express.Multer.File | undefined,
    entityType = 'post',
    createdBy?: string,
  ): Promise<ImageResponse> {
    if (!file) throw this.invalid('file is required');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw this.invalid('unsupported mime type');

    const maxMb = Number(this.config.get('UPLOAD_MAX_SIZE_MB') ?? 5);
    if (file.size > maxMb * 1024 * 1024) throw this.invalid('file too large');

    const processed = await this.imageProcessor.process(file.buffer);
    const id = randomUUID();
    const ext = EXT_BY_MIME[file.mimetype] ?? 'bin';
    const originalKey = `posts/original/${id}.${ext}`;
    const variants = processed.variants.map((v) => ({
      name: v.name,
      key: `posts/${id}-${v.name === 'thumbnail' ? 'thumb' : v.name}.webp`,
      width: v.width,
      height: v.height,
      size: v.size,
      mimeType: v.mimeType,
      buffer: v.buffer,
    }));

    await Promise.all([
      this.storage.upload(originalKey, file.buffer, file.mimetype),
      ...variants.map((v) => this.storage.upload(v.key, v.buffer, v.mimeType)),
    ]);

    const image = await this.imageRepository.create({
      id, // = uuid di key; jaga invariant id row == uuid URL (trust check PK lookup).
      entityType,
      entityId: null,
      createdBy: createdBy ?? null,
      key: originalKey,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      width: processed.original.width,
      height: processed.original.height,
      variants: variants.map(({ name, key, width, height, size, mimeType }) => ({
        name,
        key,
        width,
        height,
        size,
        mimeType,
      })) as unknown as Prisma.InputJsonValue,
      order: 0,
    });

    return this.toImageResponse(image);
  }
}
