import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, ContentVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { mapPost, postSelect, PostEntity } from './entities/post.entity';

export interface CreatePostData {
  name: string;
  slug: string;
  content: string;
  thumbnail?: string;
  status?: ContentStatus;
  visibility: ContentVisibility;
  publishedAt?: Date;
  approvedAt?: Date;
  createdBy?: string;
  categoryIds?: string[];
  imageIds?: string[];
  galleryImageIds?: string[];
  flyerImageIds?: string[];
}

export interface UpdatePostData {
  name?: string;
  slug?: string;
  content?: string;
  thumbnail?: string | null;
  status?: ContentStatus;
  visibility?: ContentVisibility;
  publishedAt?: Date;
  approvedAt?: Date;
  categoryIds?: string[];
  imageIds?: string[];
  galleryImageIds?: string[];
  flyerImageIds?: string[];
  removedGalleryImageIds?: string[];
  removedFlyerImageIds?: string[];
}

@Injectable()
export class PostRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapUnique(e: unknown): void {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Slug already exists');
    }
  }

  private async setCategories(
    tx: Prisma.TransactionClient,
    postId: string,
    categoryIds: string[],
  ): Promise<void> {
    await tx.postCategory.deleteMany({ where: { postId } });
    if (categoryIds.length > 0) {
      await tx.postCategory.createMany({
        data: categoryIds.map((categoryId) => ({ postId, categoryId })),
        skipDuplicates: true,
      });
    }
  }

  private async bindImages(
    tx: Prisma.TransactionClient,
    postId: string,
    imageIds: string[],
  ): Promise<void> {
    if (imageIds.length === 0) return;
    // Hanya bind row post yang belum terikat ATAU sudah milik post ini (jangan bajak punya post lain).
    await tx.image.updateMany({
      where: {
        id: { in: imageIds },
        entityType: 'post',
        OR: [{ entityId: null }, { entityId: postId }],
      },
      data: { entityId: postId },
    });
  }

  // Lepas binding gambar yang dikeluarkan dari galeri (entityId → null), agar bisa dipakai post lain.
  private async unbindImages(
    tx: Prisma.TransactionClient,
    postId: string,
    imageIds: string[],
  ): Promise<void> {
    if (imageIds.length === 0) return;
    await tx.image.updateMany({
      where: { id: { in: imageIds }, entityId: postId },
      data: { entityId: null },
    });
  }

  async findById(id: string): Promise<PostEntity> {
    const post = await this.prisma.post.findUnique({ where: { id }, select: postSelect });
    if (!post) throw new NotFoundException('Post not found');
    return mapPost(post);
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const found = await this.prisma.post.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(found);
  }

  async findMany(params: {
    where: Prisma.PostWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.PostOrderByWithRelationInput;
  }): Promise<{ items: PostEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({ ...params, select: postSelect }),
      this.prisma.post.count({ where: params.where }),
    ]);
    return { items: items.map(mapPost), total };
  }

  async create(data: CreatePostData): Promise<PostEntity> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const post = await tx.post.create({
          data: {
            name: data.name,
            slug: data.slug,
            content: data.content,
            thumbnail: data.thumbnail,
            status: data.status,
            visibility: data.visibility,
            publishedAt: data.publishedAt,
            approvedAt: data.approvedAt,
            createdBy: data.createdBy,
            galleryImageIds: data.galleryImageIds,
            flyerImageIds: data.flyerImageIds,
          },
          select: { id: true },
        });
        if (data.categoryIds !== undefined) await this.setCategories(tx, post.id, data.categoryIds);
        if (
          data.imageIds !== undefined ||
          data.galleryImageIds !== undefined ||
          data.flyerImageIds !== undefined
        ) {
          await this.bindImages(tx, post.id, [
            ...(data.imageIds ?? []),
            ...(data.galleryImageIds ?? []),
            ...(data.flyerImageIds ?? []),
          ]);
        }
        return mapPost(await tx.post.findUniqueOrThrow({ where: { id: post.id }, select: postSelect }));
      });
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // Update status atomik (conditional). true = tepat 1 row berubah → guard anti-TOCTOU.
  async updateStatusIf(
    id: string,
    from: ContentStatus,
    to: ContentStatus,
    extra: { approvedAt?: Date; publishedAt?: Date } = {},
  ): Promise<boolean> {
    const res = await this.prisma.post.updateMany({
      where: { id, status: from },
      data: { status: to, ...extra },
    });
    return res.count === 1;
  }

  async update(id: string, data: UpdatePostData): Promise<PostEntity> {
    const existing = await this.prisma.post.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Post not found');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const update: Prisma.PostUpdateInput = {};
        if (data.name !== undefined) update.name = data.name;
        if (data.slug !== undefined) update.slug = data.slug;
        if (data.content !== undefined) update.content = data.content;
        if (data.thumbnail !== undefined) update.thumbnail = data.thumbnail;
        if (data.status !== undefined) update.status = data.status;
        if (data.visibility !== undefined) update.visibility = data.visibility;
        if (data.publishedAt !== undefined) update.publishedAt = data.publishedAt;
        if (data.approvedAt !== undefined) update.approvedAt = data.approvedAt;
        if (data.galleryImageIds !== undefined) update.galleryImageIds = data.galleryImageIds;
        if (data.flyerImageIds !== undefined) update.flyerImageIds = data.flyerImageIds;
        if (Object.keys(update).length > 0) {
          await tx.post.update({ where: { id }, data: update });
        }
        if (data.categoryIds !== undefined) await this.setCategories(tx, id, data.categoryIds);
        if (
          data.imageIds !== undefined ||
          data.galleryImageIds !== undefined ||
          data.flyerImageIds !== undefined
        ) {
          await this.bindImages(tx, id, [
            ...(data.imageIds ?? []),
            ...(data.galleryImageIds ?? []),
            ...(data.flyerImageIds ?? []),
          ]);
        }
        if (data.removedGalleryImageIds !== undefined) {
          await this.unbindImages(tx, id, data.removedGalleryImageIds);
        }
        if (data.removedFlyerImageIds !== undefined) {
          await this.unbindImages(tx, id, data.removedFlyerImageIds);
        }
        return mapPost(await tx.post.findUniqueOrThrow({ where: { id }, select: postSelect }));
      });
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // `post_categories` ikut terhapus via FK onDelete: Cascade.
  async delete(id: string): Promise<PostEntity> {
    const post = await this.prisma.post.findUnique({ where: { id }, select: postSelect });
    if (!post) throw new NotFoundException('Post not found');
    await this.prisma.post.delete({ where: { id } });
    return mapPost(post);
  }
}
