import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ContentStatus, ContentVisibility, Prisma } from '@prisma/client';
import { AccessScope, AccessScopeService } from '@app/libs/core/auth/access-scope.service';
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
export const POST_SORT_FIELDS = ['name', 'slug', 'status', 'visibility', 'publishedAt', 'createdAt', 'updatedAt'];
export const POST_FILTER_FIELDS = ['status', 'publishedAt', 'createdAt', 'updatedAt'];
export const POST_DATE_FIELDS = ['publishedAt', 'createdAt', 'updatedAt'];

export type PostAction = 'submit' | 'approve' | 'reject' | 'publish' | 'unpublish';

// Sumber tunggal aturan transisi status story. Pure & mudah diaudit.
export const POST_TRANSITIONS: Record<PostAction, { from: ContentStatus; to: ContentStatus }> = {
  submit: { from: ContentStatus.DRAFT, to: ContentStatus.REQUEST },
  approve: { from: ContentStatus.REQUEST, to: ContentStatus.APPROVED },
  reject: { from: ContentStatus.REQUEST, to: ContentStatus.DRAFT },
  publish: { from: ContentStatus.APPROVED, to: ContentStatus.PUBLISHED },
  unpublish: { from: ContentStatus.PUBLISHED, to: ContentStatus.DRAFT },
};

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly postRepository: PostRepository,
    private readonly imageRepository: ImageRepository,
    private readonly imageService: ImageService,
    private readonly storage: StorageService,
    private readonly accessScope: AccessScopeService,
  ) {}

  // Scope baca. `none` tidak pernah sampai sini (list early-return); dikembalikan kosong agar aman.
  private scopeWhere(scope: AccessScope): Prisma.PostWhereInput | undefined {
    switch (scope.kind) {
      case 'all':
        return undefined;
      case 'organization':
        return { creator: { organizationId: scope.organizationId } };
      case 'published': {
        // Terbit berdasarkan `publishedAt`: PUBLISHED + publishedAt terisi + <= sekarang (scheduled future tersembunyi).
        const base: Prisma.PostWhereInput = {
          status: ContentStatus.PUBLISHED,
          publishedAt: { not: null, lte: new Date() },
        };
        return scope.canViewPrivate ? base : { ...base, visibility: ContentVisibility.PUBLIC };
      }
      case 'none':
        return { id: { in: [] } };
    }
  }

  // Baca: org hanya konten organisasinya; published hanya status PUBLISHED; none tolak.
  private assertReadable(post: PostEntity, scope: AccessScope): void {
    if (scope.kind === 'none') throw new ForbiddenException('Forbidden resource');
    if (post.visibility === ContentVisibility.PRIVATE && !scope.canViewPrivate) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (scope.kind === 'organization' && post.creator?.organizationId !== scope.organizationId) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (scope.kind === 'published') {
      // Sudah terbit: PUBLISHED + publishedAt terisi + <= sekarang (scheduled future → 403).
      if (
        post.status !== ContentStatus.PUBLISHED ||
        !post.publishedAt ||
        post.publishedAt.getTime() > Date.now()
      ) {
        throw new ForbiddenException('Forbidden resource');
      }
    }
  }

  // Tulis: admin bebas; organization hanya konten organisasinya; none/published tolak (defensif,
  // guard permission biasanya sudah memblok lebih dulu).
  private assertWritable(post: PostEntity, scope: AccessScope): void {
    if (scope.kind === 'organization') {
      if (post.creator?.organizationId !== scope.organizationId) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
    }
    if (scope.kind !== 'all') throw new ForbiddenException('Forbidden resource');
  }

  // Resolve `galleryImageIds` → `gallery: ImageResponse[]` berurut; `galleryImageIds` tidak dibocorkan ke FE.
  private async hydrate(posts: PostEntity[]): Promise<PostResponse[]> {
    const ids = [...new Set(posts.flatMap((post) => post.galleryImageIds))];
    const images = await this.imageRepository.findByIds(ids);
    const byId = new Map(images.map((image) => [image.id, image]));
    return posts.map(({ galleryImageIds, creator, ...post }) => ({
      ...post,
      // Buang `creator.organizationId` (tenancy internal) dari response.
      creator: creator ? { id: creator.id, fullName: creator.fullName } : null,
      gallery: galleryImageIds
        .map((id) => byId.get(id))
        .filter((image): image is NonNullable<typeof image> => Boolean(image))
        .map((image) => this.imageService.toImageResponse(image)),
    }));
  }

  // Buang id gambar asing (entityType beda / milik entity lain) sebelum di-bind.
  private async sanitizeImageIds(
    dto: { imageIds?: string[]; galleryImageIds?: string[] },
    entityId: string | null,
  ): Promise<{ imageIds?: string[]; galleryImageIds?: string[] }> {
    const [imageIds, galleryImageIds] = await Promise.all([
      dto.imageIds === undefined
        ? undefined
        : this.imageRepository.filterBindableIds(dto.imageIds, 'post', entityId),
      dto.galleryImageIds === undefined
        ? undefined
        : this.imageRepository.filterBindableIds(dto.galleryImageIds, 'post', entityId),
    ]);
    return { imageIds, galleryImageIds };
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 2; await this.postRepository.existsBySlug(slug); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }

  async list(query: ListQueryDto, userId: string): Promise<{ items: PostResponse[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, POST_SORT_FIELDS);
    const scope = await this.accessScope.resolve(userId);
    if (scope.kind === 'none') return { items: [], total: 0 };
    const filterWhere = buildWhere<Prisma.PostWhereInput>(query.filter, POST_FILTER_FIELDS, {
      enumFields: { status: ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] },
      dateFields: POST_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.PostWhereInput>(query.search, POST_SEARCHABLE_FIELDS);
    const sw = this.scopeWhere(scope);
    const scopedFilter = sw ? { AND: [sw, filterWhere] } : (filterWhere as unknown as Record<string, unknown>);
    const where = combineWhere<Prisma.PostWhereInput>(
      scopedFilter as unknown as Record<string, unknown>,
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

  async findOne(id: string, userId: string): Promise<PostResponse> {
    const [post, scope] = await Promise.all([
      this.postRepository.findById(id),
      this.accessScope.resolve(userId),
    ]);
    this.assertReadable(post, scope);
    return (await this.hydrate([post]))[0];
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
      visibility: dto.visibility ?? ContentVisibility.PUBLIC,
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

  async create(dto: CreatePostDto, userId: string): Promise<PostResponse> {
    const scope = await this.accessScope.resolve(userId);
    if (scope.kind !== 'all' && scope.kind !== 'organization') {
      throw new ForbiddenException('Forbidden resource');
    }
    // Non-admin tidak boleh memaksa status/publishedAt (tutup bypass workflow).
    const scoped = scope.kind === 'all' ? dto : { ...dto, status: ContentStatus.DRAFT, publishedAt: undefined };
    // Buang id gambar asing (post belum ada → hanya gambar tak terikat / entityType `post`).
    const prepared = { ...scoped, ...(await this.sanitizeImageIds(scoped, null)) };
    const status = prepared.status ?? ContentStatus.DRAFT;

    // Slug eksplisit: bentrok → 409 apa adanya (tanpa retry).
    if (prepared.slug) {
      const post = await this.postRepository.create(this.buildCreateData(prepared, prepared.slug, status, userId));
      return (await this.hydrate([post]))[0];
    }

    // Slug auto: retry singkat bila kalah race cek-lalu-insert (P2002 → ConflictException).
    const base = slugify(prepared.name);
    let slug = await this.uniqueSlug(base);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const post = await this.postRepository.create(this.buildCreateData(prepared, slug, status, userId));
        return (await this.hydrate([post]))[0];
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        slug = await this.uniqueSlug(base);
      }
    }
    throw new ConflictException('Slug already exists');
  }

  async update(id: string, dto: UpdatePostDto, userId: string): Promise<PostResponse> {
    const existing = await this.postRepository.findById(id);
    const scope = await this.accessScope.resolve(userId);
    this.assertWritable(existing, scope);
    const data: UpdatePostData = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.thumbnail !== undefined) data.thumbnail = dto.thumbnail;
    if (dto.categoryIds !== undefined) data.categoryIds = dto.categoryIds;
    // Sanitasi id gambar: buang milik entity lain (IDOR). entityId = post ini.
    const { imageIds, galleryImageIds } = await this.sanitizeImageIds(dto, id);
    if (imageIds !== undefined) data.imageIds = imageIds;
    if (galleryImageIds !== undefined) {
      data.galleryImageIds = galleryImageIds;
      // Lepas binding gambar yang dikeluarkan dari galeri (thumbnail/inline lama jangan disentuh).
      data.removedGalleryImageIds = existing.galleryImageIds.filter(
        (imageId) => !galleryImageIds.includes(imageId),
      );
    }
    // Visibility boleh diubah scope `all` maupun `organization` (assertWritable sudah membatasi).
    if (dto.visibility !== undefined) data.visibility = dto.visibility;

    // Scope != all: status/publishedAt dari body diabaikan (tutup bypass workflow).
    if (scope.kind === 'all') {
      if (dto.publishedAt !== undefined) {
        // Tanggal publish manual: timpa nilai lama (ubah/backdate) + paksa PUBLISHED.
        data.publishedAt = new Date(dto.publishedAt);
        data.status = ContentStatus.PUBLISHED;
      } else if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === ContentStatus.PUBLISHED && !existing.publishedAt) data.publishedAt = new Date();
        if (dto.status === ContentStatus.APPROVED && !existing.approvedAt) data.approvedAt = new Date();
      }
    }

    const post = await this.postRepository.update(id, data);
    return (await this.hydrate([post]))[0];
  }

  // Transisi status terkontrol; `PATCH /posts/:id` tetap untuk update konten.
  async transition(id: string, action: PostAction, userId: string): Promise<PostResponse> {
    const existing = await this.postRepository.findById(id); // 404 bila tak ada
    const scope = await this.accessScope.resolve(userId);
    this.assertWritable(existing, scope);
    const rule = POST_TRANSITIONS[action];
    if (existing.status !== rule.from) {
      throw new ConflictException(`Cannot ${action} post in status ${existing.status}`);
    }
    // `updateStatusIf` conditional → dua request paralel dari status sama: hanya satu sukses.
    const extra: { approvedAt?: Date; publishedAt?: Date } = {};
    if (action === 'approve' && !existing.approvedAt) extra.approvedAt = new Date();
    if (action === 'publish' && !existing.publishedAt) extra.publishedAt = new Date();
    const updated = await this.postRepository.updateStatusIf(id, rule.from, rule.to, extra);
    if (!updated) {
      const current = await this.postRepository.findById(id); // 404 bila post terhapus
      throw new ConflictException(`Cannot ${action} post in status ${current.status}`);
    }
    return this.findOne(id, userId);
  }

  // DB dulu (sumber kebenaran); objek S3 dihapus best-effort.
  async remove(id: string, userId: string): Promise<PostResponse> {
    const post = await this.postRepository.findById(id);
    const scope = await this.accessScope.resolve(userId);
    this.assertWritable(post, scope);
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
