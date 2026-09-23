import { ConflictException, ForbiddenException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ArchiveStatus, ArchiveType, CategoryType, Prisma } from '@prisma/client';
import { AccessScope, AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListArchivesQueryDto } from './dto/list-archives-query.dto';
import { CategoryRepository } from '@app/libs/modules/category/category.repository';
import { DocumentRepository } from '@app/libs/modules/document/document.repository';
import { DocumentService } from '@app/libs/modules/document/document.service';
import { ArchiveRepository, CreateArchiveData, UpdateArchiveData } from './archive.repository';
import { ArchiveCreatorRef, ArchiveEntity, ArchiveListItem, ArchiveResponse, redactMemberOnly } from './entities/archive.entity';
import { CreateArchiveDto } from './dto/create-archive.dto';
import { UpdateArchiveDto } from './dto/update-archive.dto';

export const ARCHIVE_SEARCHABLE_FIELDS = ['name', 'description'];
export const ARCHIVE_SORT_FIELDS = ['name', 'type', 'status', 'publishedAt', 'createdAt', 'updatedAt'];
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
    private readonly documentRepository: DocumentRepository,
    private readonly documentService: DocumentService,
    private readonly storage: StorageService,
    private readonly accessScope: AccessScopeService,
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
      case 'organization':
        return { creator: { organizationId: scope.organizationId } };
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
    if (scope.kind === 'organization') {
      return { creator: { organizationId: scope.organizationId } };
    }
    return { createdBy: userId };
  }

  // Baca: org hanya konten organisasinya; published hanya status PUBLISHED; none tolak.
  private assertReadable(archive: ArchiveEntity, scope: AccessScope): void {
    if (scope.kind === 'none') throw new ForbiddenException('Forbidden resource');
    if (scope.kind === 'organization' && archive.creator?.organizationId !== scope.organizationId) {
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

  // Tulis: admin bebas; organization hanya konten organisasinya; none/published tolak (defensif,
  // guard permission biasanya sudah memblok lebih dulu).
  private assertWritable(archive: ArchiveEntity, scope: AccessScope): void {
    if (scope.kind === 'organization') {
      if (archive.creator?.organizationId !== scope.organizationId) {
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

  // Buang `creator.organizationId` (tenancy internal) dari response.
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

  // Wajib setiap `documentIds` ada & belum ter-bind entity lain (kecuali archive ini).
  private async assertDocuments(documentIds?: string[], archiveId: string | null = null): Promise<void> {
    if (!documentIds || documentIds.length === 0) return;
    const documents = await this.documentRepository.findByIds(documentIds);
    const byId = new Map(documents.map((document) => [document.id, document]));
    for (let i = 0; i < documentIds.length; i++) {
      const document = byId.get(documentIds[i]);
      if (
        !document ||
        document.entityType !== 'archive' ||
        (document.entityId !== null && document.entityId !== archiveId)
      ) {
        throw this.validationError(
          `documentIds.${i}`,
          'documentId not found or already bound to another entity',
        );
      }
    }
  }

  // Resolve `documentIds` → `documents: DocumentResponse[]` berurut; `documentIds` mentah tidak dibocorkan ke FE.
  // `canViewPrivate=false` + `type=MEMBER` → `externalLinks`/`documents` di-null-kan (`redactMemberOnly`).
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

  // Item list: buang `documentIds` mentah + `creator.organizationId` tanpa lookup dokumen (hindari N+1).
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
    return { items: items.map((archive) => this.toListItem(archive, scope.canViewPrivate)), total };
  }

  async findOne(id: string, userId: string): Promise<ArchiveResponse> {
    const [archive, scope] = await Promise.all([
      this.archiveRepository.findById(id),
      this.accessScope.resolve(userId, 'archive'),
    ]);
    this.assertReadable(archive, scope); // cek scope pakai entity mentah (punya organizationId)
    return (await this.hydrate([archive], scope.canViewPrivate))[0];
  }

  async create(dto: CreateArchiveDto, userId: string): Promise<ArchiveResponse> {
    await this.assertArchiveCategories(dto.categoryIds);
    await this.assertDocuments(dto.documentIds);

    const scope = await this.accessScope.resolve(userId, 'archive');
    if (scope.kind !== 'all' && scope.kind !== 'organization' && scope.kind !== 'own') {
      throw new ForbiddenException('Forbidden resource');
    }
    // Non-admin tidak boleh memaksa status/publishedAt (tutup bypass workflow).
    const scoped: CreateArchiveDto =
      scope.kind !== 'all' ? { ...dto, status: ArchiveStatus.DRAFT, publishedAt: undefined } : dto;

    // Tanggal publish manual → pakai tanggal user + paksa PUBLISHED (status yang dikirim diabaikan).
    const autoPublish = scoped.publishedAt !== undefined;
    const status = autoPublish ? ArchiveStatus.PUBLISHED : scoped.status ?? ArchiveStatus.DRAFT;
    const now = new Date();
    const data: CreateArchiveData = {
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
    };
    const archive = await this.archiveRepository.create(data);
    return (await this.hydrate([archive], scope?.canViewPrivate ?? false))[0];
  }

  async update(id: string, dto: UpdateArchiveDto, userId: string): Promise<ArchiveResponse> {
    const existing = await this.archiveRepository.findById(id);
    const scope = await this.accessScope.resolve(userId, 'archive');
    this.assertWritable(existing, scope);
    if (dto.categoryIds !== undefined) await this.assertArchiveCategories(dto.categoryIds);
    if (dto.documentIds !== undefined) await this.assertDocuments(dto.documentIds, id);

    const data: UpdateArchiveData = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.thumbnail !== undefined) data.thumbnail = dto.thumbnail;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.categoryIds !== undefined) data.categoryIds = dto.categoryIds;
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
    return (await this.hydrate([archive], scope.canViewPrivate))[0];
  }

  // Transisi status terkontrol; `PATCH /archives/:id` tetap untuk update konten.
  // `approve` langsung PUBLISHED (+ `publishedAt`); `publish` legacy (APPROVED → PUBLISHED) tetap ada.
  async transition(
    id: string,
    action: ArchiveAction,
    userId: string,
    options?: { publishedAt?: string },
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
    const updated = await this.archiveRepository.updateStatusIf(id, rule.from, rule.to, extra);
    if (!updated) {
      const current = await this.archiveRepository.findById(id); // 404 bila archive terhapus
      throw new ConflictException(`Cannot ${action} archive in status ${current.status}`);
    }
    return this.findOne(id, userId);
  }

  // DB dulu (sumber kebenaran) dalam satu transaksi; objek S3 dihapus best-effort setelah commit.
  async remove(id: string, userId: string): Promise<ArchiveResponse> {
    const archive = await this.archiveRepository.findById(id);
    const scope = await this.accessScope.resolve(userId, 'archive');
    this.assertWritable(archive, scope);
    const response = (await this.hydrate([archive], scope.canViewPrivate))[0];
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
