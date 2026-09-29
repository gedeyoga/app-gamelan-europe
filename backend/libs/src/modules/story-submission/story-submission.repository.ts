import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, ContentVisibility, Prisma, StorySubmissionStatus } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { sanitizeStoryContent } from '@app/libs/common/utils/sanitize.util';
import { ImageRepository } from '@app/libs/modules/image/image.repository';
import { PostRepository } from '@app/libs/modules/post/post.repository';
import { slugify } from '@app/libs/modules/post/utils/slug.util';
import { storySubmissionSelect, StorySubmissionEntity, mapStorySubmission } from './entities/story-submission.entity';

export interface CreateStorySubmissionData {
  name: string;
  content: string;
  categoryIds: string[];
  galleryImageIds: string[];
  flyerImageIds: string[];
  thumbnail?: string | null;
  // Section `submitter` (data pengirim) — audit-only, tidak disalin ke Post saat approve.
  submitterFullName: string;
  submitterEmail: string;
  submitterCountryId: number;
  submitterStateId: number | null;
}

const SUBMISSION_ENTITY_TYPE = 'story-submission';
const POST_ENTITY_TYPE = 'post';

@Injectable()
export class StorySubmissionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postRepository: PostRepository,
    private readonly imageRepository: ImageRepository,
  ) {}

  async findById(id: string): Promise<StorySubmissionEntity> {
    const submission = await this.prisma.storySubmission.findUnique({
      where: { id },
      select: storySubmissionSelect,
    });
    if (!submission) throw new NotFoundException('Story submission not found');
    return mapStorySubmission(submission);
  }

  async findMany(params: {
    where: Prisma.StorySubmissionWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.StorySubmissionOrderByWithRelationInput;
  }): Promise<{ items: StorySubmissionEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.storySubmission.findMany({ ...params, select: storySubmissionSelect }),
      this.prisma.storySubmission.count({ where: params.where }),
    ]);
    return { items: items.map(mapStorySubmission), total };
  }

  // Anti-duplikat identik (name) dalam window; Serializable menutup race insert (§8 poin 7).
  async create(
    data: CreateStorySubmissionData,
    duplicateWindowMs: number,
  ): Promise<StorySubmissionEntity> {
    const since = new Date(Date.now() - duplicateWindowMs);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.storySubmission.findFirst({
            where: { name: data.name, createdAt: { gte: since } },
            select: { id: true },
          });
          if (duplicate) throw new ConflictException('Duplicate story submission');
          const created = await tx.storySubmission.create({
            data: {
              name: data.name,
              content: data.content,
              categoryIds: data.categoryIds,
              galleryImageIds: data.galleryImageIds,
              flyerImageIds: data.flyerImageIds,
              thumbnail: data.thumbnail ?? null,
              submitterFullName: data.submitterFullName,
              submitterEmail: data.submitterEmail,
              submitterCountryId: data.submitterCountryId,
              submitterStateId: data.submitterStateId ?? null,
              status: StorySubmissionStatus.REQUEST,
            },
            select: storySubmissionSelect,
          });
          return mapStorySubmission(created);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      // Serialization failure (race) → aman diperlakukan sebagai duplikat/kalah balapan.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        throw new ConflictException('Duplicate story submission');
      }
      throw e;
    }
  }

  // Approve = transaksi atomik: conditional update → reassign gallery/flyer → create Post DRAFT
  // → tautkan postId (§5.2.1). Gagal → rollback, submission tetap REQUEST.
  async approve(
    id: string,
    reviewerUserId: string,
    adminNote?: string,
  ): Promise<{ submission: StorySubmissionEntity; story: { id: string; slug: string; status: ContentStatus } }> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const res = await tx.storySubmission.updateMany({
            where: { id, status: StorySubmissionStatus.REQUEST },
            data: {
              status: StorySubmissionStatus.APPROVED,
              reviewedBy: reviewerUserId,
              reviewedAt: new Date(),
              adminNote: adminNote ?? null,
            },
          });
          if (res.count === 0) {
            const current = await tx.storySubmission.findUnique({ where: { id }, select: { status: true } });
            if (!current) throw new NotFoundException('Story submission not found');
            throw new ConflictException(`Cannot approve story submission in status ${current.status}`);
          }

          const submission = mapStorySubmission(
            await tx.storySubmission.findUniqueOrThrow({ where: { id }, select: storySubmissionSelect }),
          );

          const imageIds = [...submission.galleryImageIds, ...submission.flyerImageIds];
          // Gambar publik tersimpan `entityType='story-submission'`, `entityId=null`.
          // Pindah ke `entityType='post'` (entityId tetap null) agar `PostRepository.bindImages()`
          // mem-bind row ke post baru.
          await this.imageRepository.reassignEntityType(
            imageIds,
            SUBMISSION_ENTITY_TYPE,
            POST_ENTITY_TYPE,
            tx,
          );

          const baseSlug = slugify(submission.name);
          let slug = baseSlug;
          for (let i = 2; await this.postRepository.existsBySlug(slug, tx); i++) {
            slug = `${baseSlug}-${i}`;
          }

          const story = await this.postRepository.createInTransaction(tx, {
            name: submission.name,
            slug,
            // Sanitasi ulang saat approve (defense in depth) — jangan percaya row tersimpan.
            content: sanitizeStoryContent(submission.content),
            thumbnail: submission.thumbnail ?? undefined,
            status: ContentStatus.DRAFT,
            visibility: ContentVisibility.PUBLIC,
            createdBy: reviewerUserId,
            categoryIds: submission.categoryIds,
            galleryImageIds: submission.galleryImageIds,
            flyerImageIds: submission.flyerImageIds,
          });

          await tx.storySubmission.update({ where: { id }, data: { postId: story.id } });
          const updated = mapStorySubmission(
            await tx.storySubmission.findUniqueOrThrow({ where: { id }, select: storySubmissionSelect }),
          );
          return { submission: updated, story: { id: story.id, slug: story.slug, status: story.status } };
        });
      } catch (e) {
        // Hanya P2002 pada unique `slug` (kalah race) yang di-retry. P2002 lain
        // (mis. `postId` unique) di-rethrow — jangan disamarkan jadi 409 slug.
        const target =
          e instanceof Prisma.PrismaClientKnownRequestError ? e.meta?.target : undefined;
        const isSlugCollision =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          (Array.isArray(target) ? target.includes('slug') : target === 'slug');
        if (isSlugCollision) continue;
        throw e;
      }
    }
    throw new ConflictException('Slug already exists');
  }

  // Conditional update REQUEST → REJECTED. `count === 0` → bedakan 404 vs 409.
  async reject(id: string, reviewerUserId: string, adminNote?: string): Promise<StorySubmissionEntity> {
    const res = await this.prisma.storySubmission.updateMany({
      where: { id, status: StorySubmissionStatus.REQUEST },
      data: {
        status: StorySubmissionStatus.REJECTED,
        reviewedBy: reviewerUserId,
        reviewedAt: new Date(),
        adminNote: adminNote ?? null,
      },
    });
    if (res.count === 0) {
      const current = await this.prisma.storySubmission.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new NotFoundException('Story submission not found');
      throw new ConflictException(`Cannot reject story submission in status ${current.status}`);
    }
    return this.findById(id);
  }
}
