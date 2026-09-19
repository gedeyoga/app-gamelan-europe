import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { ImageRepository } from '@app/libs/modules/image/image.repository';
import { ImageService } from '@app/libs/modules/image/image.service';
import { PostRepository, CreatePostData, UpdatePostData } from './post.repository';
import { PostEntity, PostResponse } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { slugify } from './utils/slug.util';

export const POST_SEARCHABLE_FIELDS = ['name', 'slug'];
export const POST_SORT_FIELDS = ['name', 'slug', 'status', 'publishedAt', 'createdAt', 'updatedAt'];
export const POST_FILTER_FIELDS = ['status', 'publishedAt', 'createdAt', 'updatedAt'];
export const POST_DATE_FIELDS = ['publishedAt', 'createdAt', 'updatedAt'];

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly postRepository: PostRepository,
    private readonly imageRepository: ImageRepository,
    private readonly imageService: ImageService,
    private readonly storage: StorageService,
  ) {}

  // Resolve `galleryImageIds` → `gallery: ImageResponse[]` berurut; `galleryImageIds` tidak dibocorkan ke FE.
  private async hydrate(posts: PostEntity[]): Promise<PostResponse[]> {
    const ids = [...new Set(posts.flatMap((post) => post.galleryImageIds))];
    const images = await this.imageRepository.findByIds(ids);
    const byId = new Map(images.map((image) => [image.id, image]));
    return posts.map(({ galleryImageIds, ...post }) => ({
      ...post,
      gallery: galleryImageIds
        .map((id) => byId.get(id))
        .filter((image): image is NonNullable<typeof image> => Boolean(image))
        .map((image) => this.imageService.toImageResponse(image)),
    }));
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 2; await this.postRepository.existsBySlug(slug); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }

  async list(query: ListQueryDto): Promise<{ items: PostResponse[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, POST_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.PostWhereInput>(query.filter, POST_FILTER_FIELDS, {
      enumFields: { status: ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] },
      dateFields: POST_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.PostWhereInput>(query.search, POST_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.PostWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    const { items, total } = await this.postRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.PostOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
    return { items: await this.hydrate(items), total };
  }

  async findOne(id: string): Promise<PostResponse> {
    return (await this.hydrate([await this.postRepository.findById(id)]))[0];
  }

  private buildCreateData(dto: CreatePostDto, slug: string, status: ContentStatus, createdBy?: string): CreatePostData {
    const now = new Date();
    // Tanggal publish manual → pakai tanggal user + paksa PUBLISHED. Tanpa itu, perilaku lama.
    const autoPublish = dto.publishedAt !== undefined;
    return {
      name: dto.name,
      slug,
      content: dto.content ?? '',
      thumbnail: dto.thumbnail,
      status: autoPublish ? ContentStatus.PUBLISHED : status,
      createdBy,
      publishedAt: autoPublish
        ? new Date(dto.publishedAt!)
        : status === ContentStatus.PUBLISHED
          ? now
          : undefined,
      approvedAt: status === ContentStatus.APPROVED ? now : undefined,
      categoryIds: dto.categoryIds,
      imageIds: dto.imageIds,
      galleryImageIds: dto.galleryImageIds,
    };
  }

  async create(dto: CreatePostDto, createdBy?: string): Promise<PostResponse> {
    const status = dto.status ?? ContentStatus.DRAFT;

    // Slug eksplisit: bentrok → 409 apa adanya (tanpa retry).
    if (dto.slug) {
      const post = await this.postRepository.create(this.buildCreateData(dto, dto.slug, status, createdBy));
      return (await this.hydrate([post]))[0];
    }

    // Slug auto: retry singkat bila kalah race cek-lalu-insert (P2002 → ConflictException).
    const base = slugify(dto.name);
    let slug = await this.uniqueSlug(base);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const post = await this.postRepository.create(this.buildCreateData(dto, slug, status, createdBy));
        return (await this.hydrate([post]))[0];
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        slug = await this.uniqueSlug(base);
      }
    }
    throw new ConflictException('Slug already exists');
  }

  async update(id: string, dto: UpdatePostDto): Promise<PostResponse> {
    const existing = await this.postRepository.findById(id);
    const data: UpdatePostData = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.thumbnail !== undefined) data.thumbnail = dto.thumbnail;
    if (dto.categoryIds !== undefined) data.categoryIds = dto.categoryIds;
    if (dto.imageIds !== undefined) data.imageIds = dto.imageIds;
    if (dto.galleryImageIds !== undefined) {
      data.galleryImageIds = dto.galleryImageIds;
      // Lepas binding gambar yang dikeluarkan dari galeri (thumbnail/inline lama jangan disentuh).
      data.removedGalleryImageIds = existing.galleryImageIds.filter(
        (imageId) => !dto.galleryImageIds!.includes(imageId),
      );
    }

    if (dto.publishedAt !== undefined) {
      // Tanggal publish manual: timpa nilai lama (ubah/backdate) + paksa PUBLISHED.
      data.publishedAt = new Date(dto.publishedAt);
      data.status = ContentStatus.PUBLISHED;
    } else if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === ContentStatus.PUBLISHED && !existing.publishedAt) data.publishedAt = new Date();
      if (dto.status === ContentStatus.APPROVED && !existing.approvedAt) data.approvedAt = new Date();
    }

    const post = await this.postRepository.update(id, data);
    return (await this.hydrate([post]))[0];
  }

  // DB dulu (sumber kebenaran); objek S3 dihapus best-effort.
  async remove(id: string): Promise<PostResponse> {
    const post = await this.postRepository.findById(id);
    // Resolve galeri sebelum row images dihapus.
    const response = (await this.hydrate([post]))[0];
    const keys = await this.imageRepository.deleteByEntity('post', id);
    try {
      await this.storage.deleteObjects(keys);
    } catch {
      this.logger.warn(`S3 cleanup failed for post ${id} (${keys.length} object(s)); continuing`);
    }
    await this.postRepository.delete(id);
    return response;
  }
}
