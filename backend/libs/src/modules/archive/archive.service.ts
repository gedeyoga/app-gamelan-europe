import { ConflictException, ForbiddenException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ArchiveMaterialType, ArchiveStatus, ArchiveType, CategoryType, ContentSource, NotificationEntityType, NotificationType, Prisma } from '@prisma/client';
import { AccessScope, AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListArchivesQueryDto } from './dto/list-archives-query.dto';
import { CategoryRepository } from '@app/libs/modules/category/category.repository';
import { CategoryService } from '@app/libs/modules/category/category.service';
import { CountryRepository } from '@app/libs/modules/country/country.repository';
import { StateRepository } from '@app/libs/modules/state/state.repository';
import { ImageService } from '@app/libs/modules/image/image.service';
import { UserRepository } from '@app/libs/modules/user/user.repository';
import { UserService } from '@app/libs/modules/user/user.service';
import { DocumentRepository } from '@app/libs/modules/document/document.repository';
import { DocumentService } from '@app/libs/modules/document/document.service';
import { ArchiveRepository, CreateArchiveData, UpdateArchiveData } from './archive.repository';
import { ArchiveCreatorRef, ArchiveEntity, ArchiveListItem, ArchiveResponse, redactMemberOnly } from './entities/archive.entity';
import { CreateArchiveDto } from './dto/create-archive.dto';
import { CreatePublicArchiveDto } from './dto/create-public-archive.dto';
import { UpdateArchiveDto } from './dto/update-archive.dto';
import { slugify } from './utils/slug.util';
import { NotificationService } from '@app/libs/modules/notification/notification.service';

// ponytail: enum→label map hardcoded; ganti ke taxonomy/seed nyata bila perlu.
const ARCHIVE_MATERIAL_CATEGORY_LABELS: Record<ArchiveMaterialType, string> = {
  TUTORIALS: 'Tutorials',
  DOCUMENTARIES: 'Documentaries',
  RESEARCH: 'Research',
  DOCUMENTS: 'Documents',
  HISTORY: 'History',
};

export const ARCHIVE_SEARCHABLE_FIELDS = ['name', 'slug', 'description'];
export const ARCHIVE_SORT_FIELDS = ['name', 'slug', 'type', 'status', 'publishedAt', 'createdAt', 'updatedAt'];
export const ARCHIVE_FILTER_FIELDS = ['type', 'status', 'publishedAt', 'createdAt', 'updatedAt'];
export const ARCHIVE_DATE_FIELDS = ['publishedAt', 'createdAt', 'updatedAt'];

export type ArchiveAction = 'submit' | 'approve' | 'reject' | 'publish' | 'unpublish';

// Sumber tunggal aturan transisi status archive. Pure & mudah diaudit.
export const ARCHIVE_TRANSITIONS: Record<ArchiveAction, { from: ArchiveStatus; to: ArchiveStatus }> = {
  submit: { from: ArchiveStatus.DRAFT, to: ArchiveStatus.REQUEST },
  approve: { from: ArchiveStatus.REQUEST, to: ArchiveStatus.PUBLISHED },
  reject: { from: ArchiveStatus.REQUEST, to: ArchiveStatus.DRAFT },
  publish: { from: ArchiveStatus.APPROVED, to: ArchiveStatus.PUBLISHED },
  unpublish: { from: ArchiveStatus.PUBLISHED, to: ArchiveStatus.DRAFT },
};

@Injectable()
export class ArchiveService {
  private readonly logger = new Logger(ArchiveService.name);

  constructor(
    private readonly archiveRepository: ArchiveRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly categoryService: CategoryService,
    private readonly countryRepository: CountryRepository,
    private readonly stateRepository: StateRepository,
    private readonly imageService: ImageService,
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
    private readonly documentRepository: DocumentRepository,
    private readonly documentService: DocumentService,
    private readonly storage: StorageService,
    private readonly accessScope: AccessScopeService,
    private readonly notificationService: NotificationService,
  ) {}

  // Predikat "terbit publik" archive (TANPA kolom `visibility`): PUBLISHED + publishedAt terisi + <= now.
  private isPublished(archive: ArchiveEntity): boolean {
    return (
      archive.status === ArchiveStatus.PUBLISHED &&
      !!archive.publishedAt &&
      archive.publishedAt.getTime() <= Date.now()
    );
  }

  // Scope baca. `none` tidak pernah sampai sini (list early-return); dikembalikan kosong agar aman.
  private scopeWhere(scope: AccessScope): Prisma.ArchiveWhereInput | undefined {
    const published: Prisma.ArchiveWhereInput = {
      status: ArchiveStatus.PUBLISHED,
      publishedAt: { not: null, lte: new Date() },
    };
    switch (scope.kind) {
      case 'all':
        return undefined;
      case 'network':
        return { creator: { networkId: scope.networkId } };
      case 'own':
        return { OR: [{ createdBy: scope.userId }, published] };
      case 'published':
        return published;
      case 'none':
        return { id: { in: [] } };
    }
  }

  // "My Archive": organisasi → arsip satu organisasi; selain itu → arsip buatan user sendiri.
  // Di-AND dengan scopeWhere (bukan mengganti) supaya scoping tetap aman.
  private mineWhere(scope: AccessScope, userId: string): Prisma.ArchiveWhereInput {
    if (scope.kind === 'network') {
      return { creator: { networkId: scope.networkId } };
    }
    return { createdBy: userId };
  }

  // Baca: org hanya konten organisasinya; published hanya status PUBLISHED; none tolak.
  private assertReadable(archive: ArchiveEntity, scope: AccessScope): void {
    if (scope.kind === 'none') throw new ForbiddenException('Forbidden resource');
    if (scope.kind === 'network' && archive.creator?.networkId !== scope.networkId) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (scope.kind === 'own') {
      if (archive.creator?.id === scope.userId) return; // pemilik bebas
      if (!this.isPublished(archive)) throw new ForbiddenException('Forbidden resource');
      return;
    }
    if (scope.kind === 'published' && !this.isPublished(archive)) {
      throw new ForbiddenException('Forbidden resource');
    }
  }

  // Tulis: admin bebas; network hanya konten network-nya; none/published tolak (defensif,
  // guard permission biasanya sudah memblok lebih dulu).
  private assertWritable(archive: ArchiveEntity, scope: AccessScope): void {
    if (scope.kind === 'network') {
      if (archive.creator?.networkId !== scope.networkId) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
    }
    if (scope.kind === 'own') {
      if (archive.creator?.id !== scope.userId) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
    }
    if (scope.kind !== 'all') throw new ForbiddenException('Forbidden resource');
  }

  // Buang `creator.networkId` (tenancy internal) dari response.
  private stripCreator(creator: ArchiveEntity['creator']): ArchiveCreatorRef | null {
    return creator ? { id: creator.id, fullName: creator.fullName } : null;
  }

  private validationError(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message }],
    });
  }

  // Wajib semua `categoryIds` milik `Category.type = 'ARCHIVE'` (cegah kategori story dipakai di archive).
  private async assertArchiveCategories(categoryIds?: string[]): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) return;
    const categories = await this.categoryRepository.findByIds(categoryIds);
    const byId = new Map(categories.map((category) => [category.id, category]));
    for (let i = 0; i < categoryIds.length; i++) {
      const category = byId.get(categoryIds[i]);
      if (!category || category.type !== CategoryType.ARCHIVE) {
        throw this.validationError(
          `categoryIds.${i}`,
          'categoryId must reference a category of type ARCHIVE',
        );
      }
    }
  }

  // Wajib setiap `authorIds` ada (user) → 422 per-field (cegah P2003 FK saat createMany).
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

  // Wajib setiap `documentIds` ada & belum ter-bind entity lain (kecuali archive ini).
  private async assertDocuments(
    documentIds?: string[],
    archiveId: string | null = null,
    tx?: Prisma.TransactionClient,
    fieldPrefix = 'documentIds',
  ): Promise<void> {
    if (!documentIds || documentIds.length === 0) return;
    const documents = await this.documentRepository.findByIds(documentIds, tx);
    const byId = new Map(documents.map((document) => [document.id, document]));
    for (let i = 0; i < documentIds.length; i++) {
      const document = byId.get(documentIds[i]);
      if (
        !document ||
        document.entityType !== 'archive' ||
        (document.entityId !== null && document.entityId !== archiveId)
      ) {
        throw this.validationError(`${fieldPrefix}.${i}`, 'documentId not found or already bound to another entity');
      }
    }
  }

  // Resolve `documentIds` → `documents: DocumentResponse[]` berurut; `documentIds` mentah tidak dibocorkan ke FE.
  // Akses member = `canViewPrivate || isMember`; bila `false` + `type=MEMBER` → `externalLinks`/`documents` di-null-kan.
  private async hydrate(archives: ArchiveEntity[], canViewPrivate: boolean): Promise<ArchiveResponse[]> {
    const ids = [...new Set(archives.flatMap((archive) => archive.documentIds))];
    const documents = await this.documentRepository.findByIds(ids);
    const byId = new Map(documents.map((document) => [document.id, document]));
    return archives.map(({ documentIds, creator, ...archive }) => {
      const response: ArchiveResponse = {
        ...archive,
        creator: this.stripCreator(creator),
        documents: documentIds
          .map((id) => byId.get(id))
          .filter((document): document is NonNullable<typeof document> => Boolean(document))
          .map((document) => this.documentService.toDocumentResponse(document)),
      };
      return redactMemberOnly(response, canViewPrivate);
    });
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 2; await this.archiveRepository.existsBySlug(slug); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }

  // Semua Archive (PUBLIC & MEMBER) dikirim; MEMBER dibatasi membership aktif (Q4).
  private async notifyPublished(archive: ArchiveEntity, actorId: string, notify?: boolean): Promise<void> {
    if (archive.status !== ArchiveStatus.PUBLISHED) return;
    await this.notificationService.publishAfterCommit({
      entityType: NotificationEntityType.ARCHIVE,
      entityId: archive.id,
      title: archive.name,
      body: archive.description,
      imageUrl: archive.thumbnail,
      slug: archive.slug,
      publishedAt: archive.publishedAt,
      notify: notify !== false,
      actorId,
      archiveType: archive.type,
    });
  }

  // Item list: buang `documentIds` mentah + `creator.networkId` tanpa lookup dokumen (hindari N+1).
  private toListItem(archive: ArchiveEntity, canViewPrivate: boolean): ArchiveListItem {
    const { documentIds: _documentIds, creator, ...item } = archive;
    return redactMemberOnly({ ...item, creator: this.stripCreator(creator) }, canViewPrivate);
  }

  async list(query: ListArchivesQueryDto, userId: string): Promise<{ items: ArchiveListItem[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, ARCHIVE_SORT_FIELDS);
    const scope = await this.accessScope.resolve(userId, 'archive');
    if (scope.kind === 'none') return { items: [], total: 0 };
    const filterWhere = buildWhere<Prisma.ArchiveWhereInput>(query.filter, ARCHIVE_FILTER_FIELDS, {
      enumFields: { type: ['MEMBER', 'PUBLIC'], status: ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] },
      dateFields: ARCHIVE_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.ArchiveWhereInput>(query.search, ARCHIVE_SEARCHABLE_FIELDS);
    const clauses = [this.scopeWhere(scope), filterWhere, query.mine === 'true' ? this.mineWhere(scope, userId) : undefined].filter(
      (w): w is Prisma.ArchiveWhereInput => !!w && Object.keys(w).length > 0,
    );
    const combined = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { AND: clauses };
    const where = combineWhere<Prisma.ArchiveWhereInput>(
      combined as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    const { items, total } = await this.archiveRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.ArchiveOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
    return { items: items.map((archive) => this.toListItem(archive, scope.canViewPrivate || scope.isMember)), total };
  }

  async findOne(id: string, userId: string): Promise<ArchiveResponse> {
    return this.toReadable(await this.archiveRepository.findById(id), userId);
  }

  // Lookup via slug (tautan email `/archives/{slug}`) — aturan scope identik `findOne`.
  async findOneBySlug(slug: string, userId: string): Promise<ArchiveResponse> {
    return this.toReadable(await this.archiveRepository.findBySlug(slug), userId);
  }

  private async toReadable(archive: ArchiveEntity, userId: string): Promise<ArchiveResponse> {
    const scope = await this.accessScope.resolve(userId, 'archive');
    this.assertReadable(archive, scope); // cek scope pakai entity mentah (punya networkId)
    return (await this.hydrate([archive], scope.canViewPrivate || scope.isMember))[0];
  }

  // `tx` opsional: diteruskan dari pemanggil yang sudah membuka transaksi.
  async create(dto: CreateArchiveDto, userId: string, tx?: Prisma.TransactionClient): Promise<ArchiveResponse> {
    await this.assertArchiveCategories(dto.categoryIds);
    await this.assertAuthors(dto.authorIds);
    await this.assertDocuments(dto.documentIds, null, tx);

    const scope = await this.accessScope.resolve(userId, 'archive');
    if (scope.kind !== 'all' && scope.kind !== 'network' && scope.kind !== 'own') {
      throw new ForbiddenException('Forbidden resource');
    }
    // Non-admin tidak boleh memaksa status/publishedAt (tutup bypass workflow).
    const scoped: CreateArchiveDto =
      scope.kind !== 'all' ? { ...dto, status: ArchiveStatus.DRAFT, publishedAt: undefined } : dto;

    // Tanggal publish manual → pakai tanggal user + paksa PUBLISHED (status yang dikirim diabaikan).
    const autoPublish = scoped.publishedAt !== undefined;
    const status = autoPublish ? ArchiveStatus.PUBLISHED : scoped.status ?? ArchiveStatus.DRAFT;
    const now = new Date();
    const data: Omit<CreateArchiveData, 'slug'> = {
      name: scoped.name,
      description: scoped.description,
      thumbnail: scoped.thumbnail,
      type: scoped.type ?? ArchiveType.PUBLIC,
      status,
      publishedAt: autoPublish
        ? new Date(scoped.publishedAt!)
        : scoped.status === ArchiveStatus.PUBLISHED
          ? now
          : undefined,
      // Audit marker "pertama kali terbit" (dibuat langsung PUBLISHED), bukan status APPROVED.
      approvedAt: autoPublish || scoped.status === ArchiveStatus.PUBLISHED ? now : undefined,
      externalLinks: scoped.externalLinks ?? [],
      documentIds: scoped.documentIds ?? [],
      createdBy: userId,
      categoryIds: scoped.categoryIds,
      authorIds: scoped.authorIds,
    };
    // Slug auto: retry singkat bila kalah race cek-lalu-insert (P2002 → ConflictException).
    // Di dalam `tx` pemanggil, retry tidak aman (transaksi bisa sudah abort) → lempar apa adanya.
    const base = slugify(scoped.name);
    let slug = await this.uniqueSlug(base);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const archive = await this.archiveRepository.create({ ...data, slug }, tx);
        await this.notifyPublished(archive, userId, dto.notify);
        return (await this.hydrate([archive], scope.canViewPrivate || scope.isMember))[0];
      } catch (e) {
        if (!(e instanceof ConflictException) || tx) throw e;
        slug = await this.uniqueSlug(base);
      }
    }
    throw new ConflictException('Slug already exists');
  }

  // Submit publik (tanpa JWT): tulis langsung `Archive` status REQUEST, source PUBLIC, type PUBLIC.
  // Respons hanya { id, status } (tanpa echo row/PII). Bypass `create()` (menolak user publik).
  async createPublicSubmission(dto: CreatePublicArchiveDto): Promise<{ id: string; status: ArchiveStatus }> {
    // (1) geo archive
    if (dto.countryId != null) {
      const country = await this.countryRepository.findByIdOrNull(dto.countryId);
      if (!country) throw this.validationError('countryId', 'countryId does not exist');
    }
    if (dto.stateId != null) {
      const state = await this.stateRepository.findByIdOrNull(dto.stateId);
      if (!state || state.countryId !== dto.countryId) {
        throw this.validationError('stateId', 'stateId must belong to countryId');
      }
    }
    // (2) geo submitter
    const submitterCountry = await this.countryRepository.findByIdOrNull(dto.submitter.countryId);
    if (!submitterCountry) {
      throw this.validationError('submitter.countryId', 'submitter.countryId does not exist');
    }
    if (dto.submitter.stateId != null) {
      const submitterState = await this.stateRepository.findByIdOrNull(dto.submitter.stateId);
      if (!submitterState || submitterState.countryId !== dto.submitter.countryId) {
        throw this.validationError('submitter.stateId', 'submitter.stateId must belong to submitter.countryId');
      }
    }
    // (3) attachments (Document entityType='archive', entityId=null)
    await this.assertDocuments(dto.attachments, null, undefined, 'attachments');
    // (4) thumbnail trust
    if (dto.thumbnail) {
      const trusted = await this.imageService.isTrustedUnboundUrl(dto.thumbnail, 'archive');
      if (!trusted) {
        throw this.validationError('thumbnail', 'thumbnail must reference an uploaded EGS image');
      }
    }
    // (5) submitter → User login-less
    const user = await this.userService.findOrCreatePublicUser({
      fullName: dto.submitter.fullName,
      email: dto.submitter.email,
      countryId: submitterCountry.iso2,
      stateId: dto.submitter.stateId ?? null,
    });
    // (6) materialType → kategori idempoten (name+type)
    let categoryIds: string[] | undefined;
    if (dto.materialType) {
      const category = await this.categoryService.create({
        name: ARCHIVE_MATERIAL_CATEGORY_LABELS[dto.materialType],
        type: CategoryType.ARCHIVE,
      });
      categoryIds = [category.id];
    }
    // (7) tulis langsung (slug auto: retry singkat bila kalah race cek-lalu-insert)
    const base = slugify(dto.name);
    const data: Omit<CreateArchiveData, 'slug'> = {
      name: dto.name,
      description: dto.description,
      thumbnail: dto.thumbnail,
      externalLinks: dto.externalLinks ?? [],
      documentIds: dto.attachments ?? [],
      type: ArchiveType.PUBLIC,
      status: ArchiveStatus.REQUEST,
      source: ContentSource.PUBLIC,
      createdBy: user.id,
      authorIds: [user.id],
      categoryIds,
      date: dto.date ? new Date(dto.date) : undefined,
      author: dto.author,
      organisation: dto.organisation,
      countryId: dto.countryId,
      stateId: dto.stateId,
      materialType: dto.materialType,
    };
    let slug = await this.uniqueSlug(base);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const archive = await this.archiveRepository.create({ ...data, slug });
        await this.notificationService.notifyAdmins({
          type: NotificationType.CONTENT_SUBMITTED,
          entityType: NotificationEntityType.ARCHIVE,
          entityId: archive.id,
          title: dto.name,
          imageUrl: dto.thumbnail ?? null,
          linkPath: '/dashboard',
        });
        return { id: archive.id, status: archive.status };
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        slug = await this.uniqueSlug(base);
      }
    }
    throw new ConflictException('Slug already exists');
  }

  async update(id: string, dto: UpdateArchiveDto, userId: string): Promise<ArchiveResponse> {
    const existing = await this.archiveRepository.findById(id);
    const scope = await this.accessScope.resolve(userId, 'archive');
    this.assertWritable(existing, scope);
    if (dto.categoryIds !== undefined) await this.assertArchiveCategories(dto.categoryIds);
    if (dto.authorIds !== undefined) await this.assertAuthors(dto.authorIds);
    if (dto.documentIds !== undefined) await this.assertDocuments(dto.documentIds, id);

    const data: UpdateArchiveData = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.thumbnail !== undefined) data.thumbnail = dto.thumbnail;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.categoryIds !== undefined) data.categoryIds = dto.categoryIds;
    if (dto.authorIds !== undefined) data.authorIds = dto.authorIds;
    if (dto.externalLinks !== undefined) data.externalLinks = dto.externalLinks;
    if (dto.documentIds !== undefined) data.documentIds = dto.documentIds;

    // Scope != all: status/publishedAt dari body diabaikan (tutup bypass workflow).
    if (scope.kind === 'all') {
      if (dto.publishedAt !== undefined) {
        if (dto.publishedAt === null) {
          // `null` = kosongkan tanggal publish (status dibiarkan, tidak dipaksa PUBLISHED).
          data.publishedAt = null;
        } else {
          // Tanggal publish manual menimpa nilai lama + paksa PUBLISHED (`publishedAt` menang atas `status`).
          data.publishedAt = new Date(dto.publishedAt);
          data.status = ArchiveStatus.PUBLISHED;
          if (!existing.approvedAt) data.approvedAt = new Date();
        }
      } else if (dto.status !== undefined) {
        data.status = dto.status;
        // Naik ke PUBLISHED mengisi `publishedAt` hanya bila masih null (re-publish tidak mengubah waktu publish pertama).
        if (dto.status === ArchiveStatus.PUBLISHED) {
          if (!existing.publishedAt) data.publishedAt = new Date();
          if (!existing.approvedAt) data.approvedAt = new Date();
        }
      }
    } else if (dto.status === ArchiveStatus.DRAFT && existing.status === ArchiveStatus.PUBLISHED) {
      // Pemilik/organisasi boleh menarik kembali kontennya yang sudah terbit menjadi DRAFT.
      data.status = ArchiveStatus.DRAFT;
    }

    const archive = await this.archiveRepository.update(id, data);
    // Hanya update scope-all yang boleh menerbitkan; non-admin status/publishedAt diabaikan.
    if (scope.kind === 'all' && (dto.publishedAt !== undefined || dto.status === ArchiveStatus.PUBLISHED)) {
      await this.notifyPublished(archive, userId, dto.notify);
    }
    return (await this.hydrate([archive], scope.canViewPrivate || scope.isMember))[0];
  }

  // Transisi status terkontrol; `PATCH /archives/:id` tetap untuk update konten.
  // `approve` langsung PUBLISHED (+ `publishedAt`); `publish` legacy (APPROVED → PUBLISHED) tetap ada.
  async transition(
    id: string,
    action: ArchiveAction,
    userId: string,
    options?: { publishedAt?: string; notify?: boolean },
  ): Promise<ArchiveResponse> {
    const existing = await this.archiveRepository.findById(id); // 404 bila tak ada
    const scope = await this.accessScope.resolve(userId, 'archive');
    this.assertWritable(existing, scope);
    const rule = ARCHIVE_TRANSITIONS[action];
    if (existing.status !== rule.from) {
      throw new ConflictException(`Cannot ${action} archive in status ${existing.status}`);
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
    const publishing = action === 'approve' || action === 'publish';
    // Outbox ditulis di transaksi yang sama; job BullMQ di-enqueue setelah commit.
    const updated = await this.archiveRepository.transaction(async (tx) => {
      const row = await this.archiveRepository.updateStatusIf(id, rule.from, rule.to, extra, tx);
      if (!row) return false;
      if (publishing) {
        await this.notificationService.enqueueContentPublished(tx, {
          entityType: NotificationEntityType.ARCHIVE,
          entityId: id,
          title: existing.name,
          body: existing.description,
          imageUrl: existing.thumbnail,
          slug: existing.slug,
          publishedAt: extra.publishedAt,
          notify: options?.notify !== false,
          actorId: userId,
          archiveType: existing.type,
        });
      }
      return true;
    });
    if (!updated) {
      const current = await this.archiveRepository.findById(id); // 404 bila archive terhapus
      throw new ConflictException(`Cannot ${action} archive in status ${current.status}`);
    }
    if (publishing) await this.notificationService.enqueuePending(NotificationEntityType.ARCHIVE, id);
    return this.findOne(id, userId);
  }

  // DB dulu (sumber kebenaran) dalam satu transaksi; objek S3 dihapus best-effort setelah commit.
  // `skipScopeCheck` hanya untuk purge cascade hapus user (pemanggil sudah otorisasi `admin:access`);
  // `scope` tetap di-resolve karena `hydrate` butuh akses member (`canViewPrivate || isMember`).
  async remove(
    id: string,
    userId: string,
    options?: { skipScopeCheck?: boolean },
  ): Promise<ArchiveResponse> {
    const archive = await this.archiveRepository.findById(id);
    const scope = await this.accessScope.resolve(userId, 'archive');
    if (!options?.skipScopeCheck) this.assertWritable(archive, scope);
    const response = (await this.hydrate([archive], scope.canViewPrivate || scope.isMember))[0];
    const documents = await this.documentRepository.findByEntity('archive', id);
    const keys = documents.map((document) => document.key);
    await this.archiveRepository.delete(id);
    try {
      await this.storage.deleteObjects(keys);
    } catch {
      this.logger.warn(`S3 cleanup failed for archive ${id} (${keys.length} object(s)); continuing`);
    }
    return response;
  }
}
