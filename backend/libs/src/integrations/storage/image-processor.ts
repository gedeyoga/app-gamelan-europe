import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Metadata, ResizeOptions } from 'sharp';

// sharp@0.35 dual ESM/CJS: `types` menunjuk ESM (.d.mts) sehingga `import sharp from 'sharp'`
// salah emit di commonjs. Ambil konstruktor CJS langsung dari require.
const sharp = require('sharp') as typeof import('sharp').default;

export type VariantName = 'large' | 'medium' | 'thumbnail';

export interface ProcessedVariant {
  name: VariantName;
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  mimeType: string;
}

export interface ProcessedImage {
  original: { width: number; height: number };
  variants: ProcessedVariant[];
}

type RenderedVariant = Omit<ProcessedVariant, 'name'>;

@Injectable()
export class ImageProcessor {
  constructor(private readonly config: ConfigService) {}

  private int(key: string, fallback: number): number {
    const raw = this.config.get<string | number>(key);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private unprocessable(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field: 'file', message: 'image could not be processed' }],
    });
  }

  private async render(source: Buffer, resize: ResizeOptions, quality: number): Promise<RenderedVariant> {
    const { data, info } = await sharp(source)
      .rotate() // auto-orient EXIF; output default = strip metadata
      .resize(resize)
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      width: info.width,
      height: info.height,
      size: info.size,
      mimeType: 'image/webp',
    };
  }

  // Original tidak di-re-encode. GIF passthrough (tanpa varian) agar animasi utuh.
  async process(buffer: Buffer): Promise<ProcessedImage> {
    let meta: Metadata;
    try {
      meta = await sharp(buffer).metadata();
    } catch {
      throw this.unprocessable();
    }

    const original = { width: meta.width ?? 0, height: meta.height ?? 0 };
    if (meta.format === 'gif') {
      return { original, variants: [] };
    }

    const quality = this.int('IMAGE_WEBP_QUALITY', 82);
    const largeWidth = this.int('IMAGE_LARGE_WIDTH', 1920);
    const mediumWidth = this.int('IMAGE_MEDIUM_WIDTH', 1024);
    const thumbSize = this.int('IMAGE_THUMB_SIZE', 480);

    try {
      const variants: ProcessedVariant[] = [];

      const large = await this.render(
        buffer,
        { width: largeWidth, height: largeWidth, fit: 'inside', withoutEnlargement: true },
        quality,
      );
      // Varian large yang tidak lebih kecil dari original → fallback original (tanpa key -large).
      if (large.size < buffer.length) variants.push({ name: 'large', ...large });

      const medium = await this.render(
        buffer,
        { width: mediumWidth, height: mediumWidth, fit: 'inside', withoutEnlargement: true },
        quality,
      );
      variants.push({ name: 'medium', ...medium });

      const thumbnail = await this.render(
        buffer,
        { width: thumbSize, height: thumbSize, fit: 'cover' },
        quality,
      );
      variants.push({ name: 'thumbnail', ...thumbnail });

      return { original, variants };
    } catch {
      throw this.unprocessable();
    }
  }
}
