import { ConflictException, ForbiddenException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { CategoryType, ContentSource, ContentStatus, ContentVisibility, Prisma } from '@prisma/client';
import { AccessScope, AccessScopeService, ownReadWhere } from '@app/libs/core/auth/access-scope.service';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { sanitizeStoryContent } from '@app/libs/common/utils/sanitize.util';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { CategoryRepository } from '@app/libs/modules/category/category.repository';
import { CountryRepository } from '@app/libs/modules/country/country.repository';
import { StateRepository } from '@app/libs/modules/state/state.repository';
import { ImageRepository } from '@app/libs/modules/image/image.repository';
import { ImageService } from '@app/libs/modules/image/image.service';
import { UserRepository } from '@app/libs/modules/user/user.repository';
import { UserService } from '@app/libs/modules/user/user.service';
import { PostRepository, CreatePostData, UpdatePostData } from './post.repository';
import { PostEntity, PostFlyerItem, PostResponse } from './entities/post.entity';
import { assertUniqueFlyerItems } from '@app/libs/common/utils/flyer.util';
import { CreatePostDto } from './dto/create-post.dto';
import { CreatePublicPostDto } from './dto/create-public-post.dto';
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
    private readonly userService: UserService,
    private readonly categoryRepository: CategoryRepository,
    private readonly countryRepository: CountryRepository,
    private readonly stateRepository: StateRepository,
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
        return ownReadWhere(scope.userId, scope.canViewPrivate || scope.isMember) as Prisma.PostWhereInput;
      case 'published': {
        // Terbit berdasarkan `publishedAt`: PUBLISHED + publishedAt terisi + <= sekarang (scheduled future tersembunyi).
        const base: Prisma.PostWhereInput = {
          status: ContentStatus.PUBLISHED,
          publishedAt: { not: null, lte: new Date() },
        };
        return scope.canViewPrivate || scope.isMember ? base : { ...base, visibility: ContentVisibility.PUBLIC };
      }
      case 'none':
        return { id: { in: [] } };
    }
  }

  // Relasi: hanya post dengan minimal satu link kategori `categoryId` (`categories.some`).
  private categoryWhere(categoryId?: string): Prisma.PostWhereInput | undefined {
    if (!categoryId) return undefined;
    return { categories: { some: { categoryId } } };
  }

  // Baca: org hanya konten network-nya; published hanya status PUBLISHED; none tolak.
  private assertReadable(post: PostEntity, scope: AccessScope): void {
    if (scope.kind === 'none') throw new ForbiddenException('Forbidden resource');
    if (post.visibility === ContentVisibility.PRIVATE && !(scope.canViewPrivate || scope.isMember)) {
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

  // Resolve `galleryImageIds`/`flyerItems` → `gallery`/`flyer` berurut; id mentah tidak dibocorkan ke FE.
  // Satu lookup `findByIds` untuk gabungan galeri + semua flyer.
  private async hydrate(posts: PostEntity[]): Promise<PostResponse[]> {
    const ids = [
      ...new Set(
        posts.flatMap((post) => [
          ...post.galleryImageIds,
          ...post.flyerItems.flatMap((item) => item.imageIds),
        ]),
      ),
    ];
    const images = await this.imageRepository.findByIds(ids);
    const byId = new Map(images.map((image) => [image.id, image]));
    const resolve = (imageIds: string[]) =>
      imageIds
        .map((id) => byId.get(id))
        .filter((image): image is NonNullable<typeof image> => Boolean(image))
        .map((image) => this.imageService.toImageResponse(image));
    return posts.map(({ galleryImageIds, flyerItems, creator, ...post }) => ({
      ...post,
      // Buang `creator.networkId` (tenancy internal) dari response.
      creator: creator ? { id: creator.id, fullName: creator.fullName } : null,
      gallery: resolve(galleryImageIds),
      flyer: flyerItems.map((item) => ({ type: item.type, images: resolve(item.imageIds) })),
    }));
  }

  // Buang id gambar asing (entityType beda / milik entity lain) sebelum di-bind.
  private async sanitizeImageIds(
    dto: {
      imageIds?: string[] | null;
      galleryImageIds?: string[] | null;
      flyerItems?: { type: string; imageIds: string[] }[] | null;
    },
    entityId: string | null,
  ): Promise<{ imageIds?: string[]; galleryImageIds?: string[]; flyerItems?: PostFlyerItem[] }> {
    const [imageIds, galleryImageIds, flyerItems] = await Promise.all([
      // `null` (PartialType `@IsOptional`) = jangan sentuh, sama seperti `undefined`.
      dto.imageIds == null
        ? undefined
        : this.imageRepository.filterBindableIds(dto.imageIds, 'post', entityId),
      dto.galleryImageIds == null
        ? undefined
        : this.imageRepository.filterBindableIds(dto.galleryImageIds, 'post', entityId),
      dto.flyerItems == null
        ? undefined
        : Promise.all(
            dto.flyerItems.map(async (item) => ({
              type: item.type,
              imageIds: await this.imageRepository.filterBindableIds(item.imageIds, 'post', entityId),
            })),
          ),
    ]);
    return { imageIds, galleryImageIds, flyerItems };
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 2; await this.postRepository.existsBySlug(slug); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }

  async list(query: ListPostsQueryDto, userId: string): Promise<{ items: PostResponse[]; total: number }> {
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
    // Susun AND: scope + filter + categoryId, lalu AND dengan search (combineWhere). Bagian kosong dibuang.
    const clauses = [
      this.scopeWhere(scope),
      filterWhere,
      this.categoryWhere(query.categoryId),
    ].filter((w): w is Prisma.PostWhereInput => !!w && Object.keys(w).length > 0);
    const combined = clauses.length === 1 ? clauses[0] : { AND: clauses };
    const where = combineWhere<Prisma.PostWhereInput>(
      combined as unknown as Record<string, unknown>,
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
      source: ContentSource.REGISTERED,
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
      flyerItems: dto.flyerItems,
    };
  }

  async create(dto: CreatePostDto, userId: string): Promise<PostResponse> {
    const scope = await this.accessScope.resolve(userId, 'story');
    if (scope.kind !== 'all' && scope.kind !== 'network' && scope.kind !== 'own') {
      throw new ForbiddenException('Forbidden resource');
    }
    // Non-admin tidak boleh memaksa status/publishedAt (tutup bypass workflow).
    const scoped = scope.kind === 'all' ? dto : { ...dto, status: ContentStatus.DRAFT, publishedAt: undefined };
    assertUniqueFlyerItems(dto.flyerItems);
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

  // Submit publik (tanpa JWT): tulis langsung `Post` status REQUEST, source PUBLIC.
  // Validasi/kontrak body sama dengan form EGS lama; respons hanya { id, status } (tanpa PII echo).
  // ponytail: window anti-duplikat 10 menit dihapus — throttle 5/60s sudah cukup; tambah lagi bila spam muncul.
  async createPublicSubmission(dto: CreatePublicPostDto): Promise<{ id: string; status: ContentStatus }> {
    const country = await this.countryRepository.findByIdOrNull(dto.submitter.countryId);
    if (!country) {
      throw this.validationError('submitter.countryId', 'submitter.countryId does not exist');
    }
    if (dto.submitter.stateId !== undefined) {
      const state = await this.stateRepository.findByIdOrNull(dto.submitter.stateId);
      if (!state || state.countryId !== dto.submitter.countryId) {
        throw this.validationError('submitter.stateId', 'submitter.stateId must belong to submitter.countryId');
      }
    }

    await this.assertStoryCategories(dto.categoryIds);

    assertUniqueFlyerItems(dto.flyerItems);
    // Buang id gambar asing / sudah ter-bind (post belum ada → hanya gambar unbound entityType `post`).
    const galleryImageIds = await this.imageRepository.filterBindableIds(dto.galleryImageIds ?? [], 'post', null);
    const flyerItems: PostFlyerItem[] =
      dto.flyerItems ??
      (dto.flyerImageIds && dto.flyerImageIds.length > 0
        ? [{ type: 'flyer', imageIds: dto.flyerImageIds }]
        : []);
    const filteredFlyerItems = await Promise.all(
      flyerItems.map(async (item) => ({
        type: item.type,
        imageIds: await this.imageRepository.filterBindableIds(item.imageIds, 'post', null),
      })),
    );

    const thumbnail = dto.thumbnail?.trim() || null;
    if (thumbnail) {
      const trusted = await this.imageService.isTrustedUnboundUrl(thumbnail, 'post');
      if (!trusted) {
        throw this.validationError('thumbnail', 'thumbnail must reference an uploaded EGS image');
      }
    }

    // Sanitasi server-side (stored-XSS); payload murni tag jadi kosong → tolak.
    const content = sanitizeStoryContent(dto.content);
    if (!content.trim()) {
      throw this.validationError('content', 'content must not be empty');
    }

    const user = await this.userService.findOrCreatePublicUser({
      fullName: dto.submitter.fullName,
      email: dto.submitter.email,
      countryId: country.iso2,
      stateId: dto.submitter.stateId ?? null,
    });

    const base = slugify(dto.name);
    const data: CreatePostData = {
      name: dto.name,
      slug: await this.uniqueSlug(base),
      content,
      thumbnail: thumbnail ?? undefined,
      status: ContentStatus.REQUEST,
      source: ContentSource.PUBLIC,
      visibility: ContentVisibility.PUBLIC,
      createdBy: user.id,
      categoryIds: dto.categoryIds ?? [],
      authorIds: [user.id],
      galleryImageIds,
      flyerItems: filteredFlyerItems,
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const post = await this.postRepository.create(data);
        return { id: post.id, status: post.status };
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        data.slug = await this.uniqueSlug(base);
      }
    }
    throw new ConflictException('Slug already exists');
  }

  // Kategori STORY untuk dropdown form publik (tanpa auth).
  async listStoryCategories(): Promise<{ items: { id: string; name: string }[]; total: number }> {
    const { items, total } = await this.categoryRepository.findMany({
      where: { type: CategoryType.STORY },
      skip: 0,
      take: 100,
      orderBy: { name: 'asc' },
    });
    return { items: items.map((category) => ({ id: category.id, name: category.name })), total };
  }

  private async assertStoryCategories(categoryIds?: string[]): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) return;
    const categories = await this.categoryRepository.findByIds(categoryIds);
    const byId = new Map(categories.map((category) => [category.id, category]));
    for (let i = 0; i < categoryIds.length; i++) {
      const category = byId.get(categoryIds[i]);
      if (!category || category.type !== CategoryType.STORY) {
        throw this.validationError(`categoryIds.${i}`, 'category not found or not a STORY category');
      }
    }
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
    assertUniqueFlyerItems(dto.flyerItems);
    const { imageIds, galleryImageIds, flyerItems } = await this.sanitizeImageIds(dto, id);
    if (imageIds !== undefined) data.imageIds = imageIds;
    // m2: union id yang masih direferensikan request ini (imageIds ∪ galeri ∪ flyer) jangan
    // di-unbind, walau id keluar dari salah satu koleksi. Field yang tak dikirim → nilai lama.
    const referenced = new Set<string>([
      ...(imageIds ?? []),
      ...(galleryImageIds ?? existing.galleryImageIds),
      ...(flyerItems ?? existing.flyerItems).flatMap((item) => item.imageIds),
    ]);
    if (galleryImageIds !== undefined) {
      data.galleryImageIds = galleryImageIds;
      // Lepas binding gambar yang dikeluarkan dari galeri (thumbnail/inline lama jangan disentuh).
      data.removedGalleryImageIds = existing.galleryImageIds.filter((imageId) => !referenced.has(imageId));
    }
    if (flyerItems !== undefined) {
      data.flyerItems = flyerItems;
      // Lepas binding gambar yang dikeluarkan dari flyer (thumbnail/inline lama jangan disentuh).
      data.removedFlyerImageIds = existing.flyerItems
        .flatMap((item) => item.imageIds)
        .filter((imageId) => !referenced.has(imageId));
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
