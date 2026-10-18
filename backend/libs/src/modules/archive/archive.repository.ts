import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ArchiveMaterialType, ArchiveStatus, ArchiveType, ContentSource, Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { DocumentRepository } from '@app/libs/modules/document/document.repository';
import { mapArchive, archiveSelect, ArchiveEntity } from './entities/archive.entity';

export interface CreateArchiveData {
  name: string;
  slug: string;
  description?: string;
  thumbnail?: string;
  type: ArchiveType;
  status: ArchiveStatus;
  source?: ContentSource;
  publishedAt?: Date;
  approvedAt?: Date;
  externalLinks: string[];
  documentIds: string[];
  createdBy?: string;
  categoryIds?: string[];
  authorIds?: string[];
  date?: Date;
  author?: string;
  organisation?: string;
  countryId?: number;
  stateId?: number;
  materialType?: ArchiveMaterialType;
}

export interface UpdateArchiveData {
  name?: string;
  description?: string;
  thumbnail?: string | null;
  type?: ArchiveType;
  status?: ArchiveStatus;
  publishedAt?: Date | null;
  approvedAt?: Date;
  externalLinks?: string[];
  documentIds?: string[];
  categoryIds?: string[];
  authorIds?: string[];
}

@Injectable()
export class ArchiveRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentRepository: DocumentRepository,
  ) {}

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient | PrismaService {
    return tx ?? this.prisma;
  }

  private mapUnique(e: unknown): void {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Slug already exists');
    }
  }

  private async setCategories(
    tx: Prisma.TransactionClient,
    archiveId: string,
    categoryIds: string[],
  ): Promise<void> {
    await tx.archiveCategory.deleteMany({ where: { archiveId } });
    if (categoryIds.length > 0) {
      await tx.archiveCategory.createMany({
        data: categoryIds.map((categoryId) => ({ archiveId, categoryId })),
        skipDuplicates: true,
      });
    }
  }

  private async setAuthors(
    tx: Prisma.TransactionClient,
    archiveId: string,
    authorIds: string[],
  ): Promise<void> {
    await tx.archiveAuthor.deleteMany({ where: { archiveId } });
    if (authorIds.length > 0) {
      await tx.archiveAuthor.createMany({
        data: authorIds.map((authorId) => ({ archiveId, authorId })),
        skipDuplicates: true,
      });
    }
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<ArchiveEntity> {
    const archive = await this.client(tx).archive.findUnique({ where: { id }, select: archiveSelect });
    if (!archive) throw new NotFoundException('Archive not found');
    return mapArchive(archive);
  }

  // Lookup untuk tautan email (`/archives/{slug}`).
  async findBySlug(slug: string): Promise<ArchiveEntity> {
    const archive = await this.prisma.archive.findUnique({ where: { slug }, select: archiveSelect });
    if (!archive) throw new NotFoundException('Archive not found');
    return mapArchive(archive);
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const found = await this.prisma.archive.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(found);
  }

  // Id-only (tanpa hydrate) untuk purge cascade hapus user; cleanup dokumen/S3 diurus `ArchiveService.remove` per id.
  async findIdsByAuthorId(authorId: string): Promise<string[]> {
    const rows = await this.prisma.archive.findMany({
      where: { authors: { some: { authorId } } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async findMany(params: {
    where: Prisma.ArchiveWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.ArchiveOrderByWithRelationInput;
  }): Promise<{ items: ArchiveEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.archive.findMany({ ...params, select: archiveSelect }),
      this.prisma.archive.count({ where: params.where }),
    ]);
    return { items: items.map(mapArchive), total };
  }

  // `tx` opsional: bila diberikan (pemanggil sudah membuka transaksi), pakai client itu tanpa
  // membuka `$transaction` bersarang. Tanpa `tx` perilaku lama dipertahankan.
  async create(data: CreateArchiveData, tx?: Prisma.TransactionClient): Promise<ArchiveEntity> {
    const run = async (client: Prisma.TransactionClient): Promise<ArchiveEntity> => {
      const archive = await client.archive.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          thumbnail: data.thumbnail,
          type: data.type,
          status: data.status,
          source: data.source,
          publishedAt: data.publishedAt,
          approvedAt: data.approvedAt,
          externalLinks: data.externalLinks,
          documentIds: data.documentIds,
          createdBy: data.createdBy,
          date: data.date,
          author: data.author,
          organisation: data.organisation,
          countryId: data.countryId,
          stateId: data.stateId,
          materialType: data.materialType,
        },
        select: { id: true },
      });
      if (data.categoryIds !== undefined) await this.setCategories(client, archive.id, data.categoryIds);
      if (data.authorIds !== undefined) await this.setAuthors(client, archive.id, data.authorIds);
      await this.documentRepository.bind(data.documentIds, 'archive', archive.id, client);
      return mapArchive(
        await client.archive.findUniqueOrThrow({ where: { id: archive.id }, select: archiveSelect }),
      );
    };
    try {
      return tx ? await run(tx) : await this.prisma.$transaction(run);
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // Update status atomik (conditional). Non-null = tepat 1 row berubah → guard anti-TOCTOU.
  async updateStatusIf(
    id: string,
    from: ArchiveStatus,
    to: ArchiveStatus,
    extra: { approvedAt?: Date; publishedAt?: Date } = {},
    tx?: Prisma.TransactionClient,
  ): Promise<ArchiveEntity | null> {
    const res = await this.client(tx).archive.updateMany({
      where: { id, status: from },
      data: { status: to, ...extra },
    });
    if (res.count !== 1) return null;
    return this.findById(id, tx);
  }

  async update(id: string, data: UpdateArchiveData): Promise<ArchiveEntity> {
    const existing = await this.prisma.archive.findUnique({
      where: { id },
      select: { id: true, documentIds: true },
    });
    if (!existing) throw new NotFoundException('Archive not found');

    return this.prisma.$transaction(async (tx) => {
      const update: Prisma.ArchiveUpdateInput = {};
      if (data.name !== undefined) update.name = data.name;
      if (data.description !== undefined) update.description = data.description;
      if (data.thumbnail !== undefined) update.thumbnail = data.thumbnail;
      if (data.type !== undefined) update.type = data.type;
      if (data.status !== undefined) update.status = data.status;
      if (data.publishedAt !== undefined) update.publishedAt = data.publishedAt;
      if (data.approvedAt !== undefined) update.approvedAt = data.approvedAt;
      if (data.externalLinks !== undefined) update.externalLinks = data.externalLinks;
      if (data.documentIds !== undefined) update.documentIds = data.documentIds;
      if (Object.keys(update).length > 0) {
        await tx.archive.update({ where: { id }, data: update });
      }
      if (data.categoryIds !== undefined) await this.setCategories(tx, id, data.categoryIds);
      if (data.authorIds !== undefined) await this.setAuthors(tx, id, data.authorIds);
      if (data.documentIds !== undefined) {
        await this.documentRepository.bind(data.documentIds, 'archive', id, tx);
        // Lepas binding dokumen yang dikeluarkan dari daftar (replace seluruh array).
        const removed = existing.documentIds.filter((docId) => !data.documentIds!.includes(docId));
        await this.documentRepository.unbind(removed, 'archive', id, tx);
      }
      return mapArchive(await tx.archive.findUniqueOrThrow({ where: { id }, select: archiveSelect }));
    });
  }

  // `archive_categories` ikut terhapus via FK onDelete: Cascade.
  // Hapus baris dokumen + archive dalam satu transaksi (atomic); objek S3 diurus service.
  async delete(id: string): Promise<ArchiveEntity> {
    const archive = await this.prisma.archive.findUnique({ where: { id }, select: archiveSelect });
    if (!archive) throw new NotFoundException('Archive not found');
    await this.prisma.$transaction(async (tx) => {
      await this.documentRepository.deleteByEntity('archive', id, tx);
      await tx.archive.delete({ where: { id } });
    });
    return mapArchive(archive);
  }
}
