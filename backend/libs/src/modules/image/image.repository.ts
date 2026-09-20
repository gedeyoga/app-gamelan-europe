import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { imageSelect, ImageEntity, ImageVariant } from './entities/image.entity';

@Injectable()
export class ImageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ImageUncheckedCreateInput): Promise<ImageEntity> {
    return this.prisma.image.create({ data, select: imageSelect });
  }

  async findByIds(ids: string[]): Promise<ImageEntity[]> {
    if (ids.length === 0) return [];
    return this.prisma.image.findMany({ where: { id: { in: ids } }, select: imageSelect });
  }

  // Hanya id gambar yang boleh di-bind: entityType cocok & belum terikat ATAU sudah milik entity ini.
  async filterBindableIds(ids: string[], entityType: string, entityId: string | null): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.image.findMany({
      where: {
        id: { in: ids },
        entityType,
        OR: entityId ? [{ entityId: null }, { entityId }] : [{ entityId: null }],
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  // Hapus row + kembalikan key S3 original + SEMUA variants[].key untuk cleanup best-effort.
  async deleteByEntity(entityType: string, entityId: string): Promise<string[]> {
    const images = await this.prisma.image.findMany({
      where: { entityType, entityId },
      select: { key: true, variants: true },
    });
    if (images.length === 0) return [];
    await this.prisma.image.deleteMany({ where: { entityType, entityId } });
    return images.flatMap((image) => {
      const variants = (image.variants as unknown as ImageVariant[] | null) ?? [];
      return [image.key, ...variants.map((v) => v.key)];
    });
  }
}
