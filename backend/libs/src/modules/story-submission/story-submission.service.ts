import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { CategoryType, Prisma, StorySubmissionStatus } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { sanitizeStoryContent } from '@app/libs/common/utils/sanitize.util';
import { CategoryRepository } from '@app/libs/modules/category/category.repository';
import { ImageRepository } from '@app/libs/modules/image/image.repository';
import { ImageService, ImageResponse } from '@app/libs/modules/image/image.service';
import { StorySubmissionRepository, CreateStorySubmissionData } from './story-submission.repository';
import {
  StorySubmissionEntity,
  StorySubmissionListItem,
  StorySubmissionDetail,
  SubmissionCategoryRef,
} from './entities/story-submission.entity';
import { CreateStorySubmissionDto } from './dto/create-story-submission.dto';
import { ReviewStorySubmissionDto } from './dto/review-story-submission.dto';
import { ListStorySubmissionsQueryDto } from './dto/list-story-submissions-query.dto';

export const STORY_SUBMISSION_SEARCHABLE_FIELDS = ['name'];
export const STORY_SUBMISSION_SORT_FIELDS = ['name', 'status', 'createdAt', 'updatedAt'];
export const STORY_SUBMISSION_FILTER_FIELDS = ['status', 'createdAt', 'updatedAt', 'reviewedAt'];
export const STORY_SUBMISSION_DATE_FIELDS = ['reviewedAt', 'createdAt', 'updatedAt'];

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const SUBMISSION_ENTITY_TYPE = 'story-submission';

@Injectable()
export class StorySubmissionService {
  constructor(
    private readonly storySubmissionRepository: StorySubmissionRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly imageRepository: ImageRepository,
    private readonly imageService: ImageService,
  ) {}

  private validationError(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message }],
    });
  }

  private categoryRefs(ids: string[], byId: Map<string, { id: string; name: string }>): SubmissionCategoryRef[] {
    return ids
      .map((id) => byId.get(id))
      .filter((category): category is NonNullable<typeof category> => Boolean(category))
      .map((category) => ({ id: category.id, name: category.name }));
  }

  // Item list: buang `content`/id mentah, ekspos nama kategori + jumlah gambar.
  // Resolve nama kategori SEKALI secara batch (hindari N+1).
  private async toListItems(submissions: StorySubmissionEntity[]): Promise<StorySubmissionListItem[]> {
    const ids = [...new Set(submissions.flatMap((submission) => submission.categoryIds))];
    const categories = await this.categoryRepository.findByIds(ids);
    const byId = new Map(categories.map((category) => [category.id, category]));
    return submissions.map((submission) => {
      const { content, categoryIds, galleryImageIds, flyerImageIds, ...rest } = submission;
      return {
        ...rest,
        categories: this.categoryRefs(categoryIds, byId),
        galleryCount: galleryImageIds.length,
        flyerCount: flyerImageIds.length,
      };
    });
  }

  // Detail: item list + `content` + `categoryIds` mentah + galeri/flyer ter-resolve berurut.
  private async hydrate(submission: StorySubmissionEntity): Promise<StorySubmissionDetail> {
    const { galleryImageIds, flyerImageIds, categoryIds, ...rest } = submission;
    const [categories, images] = await Promise.all([
      this.categoryRepository.findByIds(categoryIds),
      this.imageRepository.findByIds([...new Set([...galleryImageIds, ...flyerImageIds])]),
    ]);
    const byId = new Map(images.map((image) => [image.id, image]));
    const resolve = (imageIds: string[]): ImageResponse[] =>
      imageIds
        .map((id) => byId.get(id))
        .filter((image): image is NonNullable<typeof image> => Boolean(image))
        .map((image) => this.imageService.toImageResponse(image));
    const catById = new Map(categories.map((category) => [category.id, category]));
    return {
      ...rest,
      categories: this.categoryRefs(categoryIds, catById),
      categoryIds,
      galleryCount: galleryImageIds.length,
      flyerCount: flyerImageIds.length,
      gallery: resolve(galleryImageIds),
      flyer: resolve(flyerImageIds),
    };
  }

  async list(
    query: ListStorySubmissionsQueryDto,
  ): Promise<{ items: StorySubmissionListItem[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, STORY_SUBMISSION_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.StorySubmissionWhereInput>(
      query.filter,
      STORY_SUBMISSION_FILTER_FIELDS,
      {
        enumFields: { status: ['REQUEST', 'APPROVED', 'REJECTED'] },
        dateFields: STORY_SUBMISSION_DATE_FIELDS,
      },
    );
    const searchWhere = buildSearch<Prisma.StorySubmissionWhereInput>(
      query.search,
      STORY_SUBMISSION_SEARCHABLE_FIELDS,
    );
    const where = combineWhere<Prisma.StorySubmissionWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    const { items, total } = await this.storySubmissionRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.StorySubmissionOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
    return { items: await this.toListItems(items), total };
  }

  async findOne(id: string): Promise<StorySubmissionDetail> {
    return this.hydrate(await this.storySubmissionRepository.findById(id));
  }

  // Daftar kategori STORY untuk form publik (tanpa auth).
  async listCategories(): Promise<{ items: SubmissionCategoryRef[]; total: number }> {
    const { items, total } = await this.categoryRepository.findMany({
      where: { type: CategoryType.STORY },
      skip: 0,
      take: 100,
      orderBy: { name: 'asc' },
    });
    return { items: items.map((category) => ({ id: category.id, name: category.name })), total };
  }

  private async assertValidImageIds(ids: string[], field: string): Promise<void> {
    const images = await this.imageRepository.findByIds(ids);
    const byId = new Map(images.map((image) => [image.id, image]));
    for (let i = 0; i < ids.length; i++) {
      const image = byId.get(ids[i]);
      if (!image || image.entityType !== SUBMISSION_ENTITY_TYPE || image.entityId !== null) {
        throw this.validationError(`${field}.${i}`, 'image not found, wrong type, or already bound');
      }
    }
  }

  async create(dto: CreateStorySubmissionDto): Promise<{ id: string; status: StorySubmissionStatus }> {
    // Setiap kategori wajib ada & bertipe STORY.
    if (dto.categoryIds && dto.categoryIds.length > 0) {
      const categories = await this.categoryRepository.findByIds(dto.categoryIds);
      const byId = new Map(categories.map((category) => [category.id, category]));
      for (let i = 0; i < dto.categoryIds.length; i++) {
        const category = byId.get(dto.categoryIds[i]);
        if (!category || category.type !== CategoryType.STORY) {
          throw this.validationError(`categoryIds.${i}`, 'category not found or not a STORY category');
        }
      }
    }

    // Setiap id gambar wajib ada, bertipe submission, & belum ter-bind.
    if (dto.galleryImageIds && dto.galleryImageIds.length > 0) {
      await this.assertValidImageIds(dto.galleryImageIds, 'galleryImageIds');
    }
    if (dto.flyerImageIds && dto.flyerImageIds.length > 0) {
      await this.assertValidImageIds(dto.flyerImageIds, 'flyerImageIds');
    }

    const thumbnail = dto.thumbnail?.trim() || null;
    if (thumbnail) {
      const trusted = await this.imageService.isTrustedUnboundUrl(thumbnail, SUBMISSION_ENTITY_TYPE);
      if (!trusted) {
        throw this.validationError('thumbnail', 'thumbnail must reference an uploaded EGS image');
      }
    }

    // Sanitasi server-side sebelum disimpan (stored-XSS). Payload murni tag
    // (mis. `<script>x</script>`) jadi string kosong → tolak agar tak buat Post kosong.
    const content = sanitizeStoryContent(dto.content);
    if (!content.trim()) {
      throw this.validationError('content', 'content must not be empty');
    }

    const data: CreateStorySubmissionData = {
      name: dto.name,
      content,
      categoryIds: dto.categoryIds ?? [],
      galleryImageIds: dto.galleryImageIds ?? [],
      flyerImageIds: dto.flyerImageIds ?? [],
      thumbnail,
    };
    const created = await this.storySubmissionRepository.create(data, DUPLICATE_WINDOW_MS);
    // Respons publik hanya { id, status } — tanpa echo row/PII (§8 poin 11).
    return { id: created.id, status: created.status };
  }

  async approve(
    id: string,
    reviewerUserId: string,
    dto: ReviewStorySubmissionDto = {},
  ): Promise<{
    submission: StorySubmissionListItem;
    story: { id: string; slug: string; status: string };
  }> {
    const { submission, story } = await this.storySubmissionRepository.approve(
      id,
      reviewerUserId,
      dto.adminNote,
    );
    const [item] = await this.toListItems([submission]);
    return { submission: item, story };
  }

  async reject(
    id: string,
    reviewerUserId: string,
    dto: ReviewStorySubmissionDto = {},
  ): Promise<StorySubmissionListItem> {
    const [item] = await this.toListItems([
      await this.storySubmissionRepository.reject(id, reviewerUserId, dto.adminNote),
    ]);
    return item;
  }
}
