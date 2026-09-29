import { ConflictException, ForbiddenException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ContentStatus, ContentVisibility, Prisma } from '@prisma/client';
import { AccessScope, AccessScopeService, ownReadWhere } from '@app/libs/core/auth/access-scope.service';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { ImageRepository } from '@app/libs/modules/image/image.repository';
import { ImageService } from '@app/libs/modules/image/image.service';
import { UserRepository } from '@app/libs/modules/user/user.repository';
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
  approve: { from: ContentStatus.REQUEST, to: ContentStatus.PUBLISHED },
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
    private readonly userRepository: UserRepository,
    private readonly storage: StorageService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private validationError(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message }],
    });
  }

  // Cek existence setiap authorIds (user) → 422 per-field (cegah P2003 FK saat createMany).
  private async assertAuthors(authorIds?: string[]): Promise<void> {
    if (!authorIds || authorIds.length === 0) return;
    const users = await this.userRepository.findByIds(authorIds);
    const found = new Set(users.map((user) => user.id));
    for (let i = 0; i < authorIds.length; i++) {
      if (!found.has(authorIds[i])) {
        throw this.validationError(`authorIds.${i}`, 'authorId must reference an existing user');
      }
    }
  }

  // Scope baca. `none` tidak pernah sampai sini (list early-return); dikembalikan kosong agar aman.
  private scopeWhere(scope: AccessScope): Prisma.PostWhereInput | undefined {
    switch (scope.kind) {
      case 'all':
        return undefined;
      case 'network':
        return { creator: { networkId: scope.networkId } };
      case 'own':
        return ownReadWhere(scope.userId, scope.canViewPrivate) as Prisma.PostWhereInput;
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

  // Baca: org hanya konten network-nya; published hanya status PUBLISHED; none tolak.
  private assertReadable(post: PostEntity, scope: AccessScope): void {
    if (scope.kind === 'none') throw new ForbiddenException('Forbidden resource');
    if (post.visibility === ContentVisibility.PRIVATE && !scope.canViewPrivate) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (scope.kind === 'network' && post.creator?.networkId !== scope.networkId) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (scope.kind === 'own') {
      if (post.createdBy === scope.userId) return; // pemilik bebas
      // Bukan pemilik → baca konten terbit saja (M5).
      if (
        post.status !== ContentStatus.PUBLISHED ||
        !post.publishedAt ||
        post.publishedAt.getTime() > Date.now()
      ) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
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

  // Tulis: admin bebas; network hanya konten network-nya; none/published tolak (defensif,
  // guard permission biasanya sudah memblok lebih dulu).
  private assertWritable(post: PostEntity, scope: AccessScope): void {
    if (scope.kind === 'network') {
      if (post.creator?.networkId !== scope.networkId) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
    }
    if (scope.kind === 'own') {
      if (post.createdBy !== scope.userId) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
    }
    if (scope.kind !== 'all') throw new ForbiddenException('Forbidden resource');
  }

  // Resolve `galleryImageIds`/`flyerImageIds` → `gallery`/`flyer: ImageResponse[]` berurut; id mentah tidak dibocorkan ke FE.
  private async hydrate(posts: PostEntity[]): Promise<PostResponse[]> {
    const ids = [
      ...new Set(posts.flatMap((post) => [...post.galleryImageIds, ...post.flyerImageIds])),
    ];
    const images = await this.imageRepository.findByIds(ids);
    const byId = new Map(images.map((image) => [image.id, image]));
    const resolve = (imageIds: string[]) =>
      imageIds
        .map((id) => byId.get(id))
        .filter((image): image is NonNullable<typeof image> => Boolean(image))
        .map((image) => this.imageService.toImageResponse(image));
    return posts.map(({ galleryImageIds, flyerImageIds, creator, ...post }) => ({
      ...post,
      // Buang `creator.networkId` (tenancy internal) dari response.
      creator: creator ? { id: creator.id, fullName: creator.fullName } : null,
      gallery: resolve(galleryImageIds),
      flyer: resolve(flyerImageIds),
    }));
  }

  // Buang id gambar asing (entityType beda / milik entity lain) sebelum di-bind.
  private async sanitizeImageIds(
    dto: { imageIds?: string[]; galleryImageIds?: string[]; flyerImageIds?: string[] },
    entityId: string | null,
  ): Promise<{ imageIds?: string[]; galleryImageIds?: string[]; flyerImageIds?: string[] }> {
    const [imageIds, galleryImageIds, flyerImageIds] = await Promise.all([
      dto.imageIds === undefined
        ? undefined
        : this.imageRepository.filterBindableIds(dto.imageIds, 'post', entityId),
      dto.galleryImageIds === undefined
        ? undefined
        : this.imageRepository.filterBindableIds(dto.galleryImageIds, 'post', entityId),
      dto.flyerImageIds === undefined
        ? undefined
        : this.imageRepository.filterBindableIds(dto.flyerImageIds, 'post', entityId),
    ]);
    return { imageIds, galleryImageIds, flyerImageIds };
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
    const scope = await this.accessScope.resolve(userId, 'story');
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
      this.accessScope.resolve(userId, 'story'),
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
      // Audit marker "pertama kali terbit" (dibuat langsung PUBLISHED), bukan status APPROVED.
      approvedAt: autoPublish || status === ContentStatus.PUBLISHED ? now : undefined,
      categoryIds: dto.categoryIds,
      authorIds: dto.authorIds,
      imageIds: dto.imageIds,
      galleryImageIds: dto.galleryImageIds,
      flyerImageIds: dto.flyerImageIds,
    };
  }

  async create(dto: CreatePostDto, userId: string): Promise<PostResponse> {
    const scope = await this.accessScope.resolve(userId, 'story');
    if (scope.kind !== 'all' && scope.kind !== 'network' && scope.kind !== 'own') {
      throw new ForbiddenException('Forbidden resource');
    }
    // Non-admin tidak boleh memaksa status/publishedAt (tutup bypass workflow).
    const scoped = scope.kind === 'all' ? dto : { ...dto, status: ContentStatus.DRAFT, publishedAt: undefined };
    // Buang id gambar asing (post belum ada → hanya gambar tak terikat / entityType `post`).
    const prepared = { ...scoped, ...(await this.sanitizeImageIds(scoped, null)) };
    await this.assertAuthors(prepared.authorIds);
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
    const scope = await this.accessScope.resolve(userId, 'story');
    this.assertWritable(existing, scope);
    const data: UpdatePostData = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.thumbnail !== undefined) data.thumbnail = dto.thumbnail;
    if (dto.categoryIds !== undefined) data.categoryIds = dto.categoryIds;
    if (dto.authorIds !== undefined) {
      await this.assertAuthors(dto.authorIds);
      data.authorIds = dto.authorIds;
    }
    // Sanitasi id gambar: buang milik entity lain (IDOR). entityId = post ini.
    const { imageIds, galleryImageIds, flyerImageIds } = await this.sanitizeImageIds(dto, id);
    if (imageIds !== undefined) data.imageIds = imageIds;
    if (galleryImageIds !== undefined) {
      data.galleryImageIds = galleryImageIds;
      // Lepas binding gambar yang dikeluarkan dari galeri (thumbnail/inline lama jangan disentuh).
      data.removedGalleryImageIds = existing.galleryImageIds.filter(
        (imageId) => !galleryImageIds.includes(imageId),
      );
    }
    if (flyerImageIds !== undefined) {
      data.flyerImageIds = flyerImageIds;
      // Lepas binding gambar yang dikeluarkan dari flyer (thumbnail/inline lama jangan disentuh).
      data.removedFlyerImageIds = existing.flyerImageIds.filter(
        (imageId) => !flyerImageIds.includes(imageId),
      );
    }
    // Visibility boleh diubah scope `all` maupun `network` (assertWritable sudah membatasi).
    if (dto.visibility !== undefined) data.visibility = dto.visibility;

    // Scope != all: status/publishedAt dari body diabaikan (tutup bypass workflow).
    if (scope.kind === 'all') {
      if (dto.publishedAt !== undefined) {
        // Tanggal publish manual: timpa nilai lama (ubah/backdate) + paksa PUBLISHED.
        data.publishedAt = new Date(dto.publishedAt);
        data.status = ContentStatus.PUBLISHED;
        if (!existing.approvedAt) data.approvedAt = new Date();
      } else if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === ContentStatus.PUBLISHED) {
          if (!existing.publishedAt) data.publishedAt = new Date();
          if (!existing.approvedAt) data.approvedAt = new Date();
        }
      }
    } else if (dto.status === ContentStatus.DRAFT && existing.status === ContentStatus.PUBLISHED) {
      // Pemilik/organisasi boleh menarik kembali kontennya yang sudah terbit menjadi DRAFT.
      // `publishedAt`/`approvedAt` dibiarkan (konsisten dengan transisi `unpublish`).
      data.status = ContentStatus.DRAFT;
    }

    const post = await this.postRepository.update(id, data);
    return (await this.hydrate([post]))[0];
  }

  // Transisi status terkontrol; `PATCH /posts/:id` tetap untuk update konten.
  // `approve` langsung PUBLISHED (+ `publishedAt`); `publish` legacy (APPROVED → PUBLISHED) tetap ada.
  async transition(
    id: string,
    action: PostAction,
    userId: string,
    options?: { publishedAt?: string },
  ): Promise<PostResponse> {
    const existing = await this.postRepository.findById(id); // 404 bila tak ada
    const scope = await this.accessScope.resolve(userId, 'story');
    this.assertWritable(existing, scope);
    const rule = POST_TRANSITIONS[action];
    if (existing.status !== rule.from) {
      throw new ConflictException(`Cannot ${action} post in status ${existing.status}`);
    }
    // `updateStatusIf` conditional → dua request paralel dari status sama: hanya satu sukses.
    // `approvedAt` = audit marker "pertama kali terbit" (server-managed), bukan status APPROVED.
    const extra: { approvedAt?: Date; publishedAt?: Date } = {};
    if (action === 'approve' || action === 'publish') {
      extra.publishedAt = options?.publishedAt
        ? new Date(options.publishedAt)
        : (existing.publishedAt ?? new Date());
      extra.approvedAt = existing.approvedAt ?? new Date();
    }
    const updated = await this.postRepository.updateStatusIf(id, rule.from, rule.to, extra);
    if (!updated) {
      const current = await this.postRepository.findById(id); // 404 bila post terhapus
      throw new ConflictException(`Cannot ${action} post in status ${current.status}`);
    }
    return this.findOne(id, userId);
  }

  // DB dulu (sumber kebenaran); objek S3 dihapus best-effort.
  // `skipScopeCheck` hanya untuk purge cascade hapus user (pemanggil sudah otorisasi `admin:access`).
  async remove(
    id: string,
    userId: string,
    options?: { skipScopeCheck?: boolean },
  ): Promise<PostResponse> {
    const post = await this.postRepository.findById(id);
    const scope = await this.accessScope.resolve(userId, 'story');
    if (!options?.skipScopeCheck) this.assertWritable(post, scope);
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
