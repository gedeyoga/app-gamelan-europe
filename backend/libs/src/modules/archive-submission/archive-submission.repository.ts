import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ArchiveStatus, ArchiveSubmissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { ArchiveService } from '@app/libs/modules/archive/archive.service';
import { DocumentRepository } from '@app/libs/modules/document/document.repository';
import {
  archiveSubmissionSelect,
  ArchiveSubmissionEntity,
  mapArchiveSubmission,
} from './entities/archive-submission.entity';

export interface CreateArchiveSubmissionData {
  name: string;
  description?: string | null;
  thumbnail?: string | null;
  externalLinks: string[];
  attachmentIds: string[];
}

const SUBMISSION_DOCUMENT_ENTITY_TYPE = 'archive-submission';
const ARCHIVE_DOCUMENT_ENTITY_TYPE = 'archive';

@Injectable()
export class ArchiveSubmissionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentRepository: DocumentRepository,
    private readonly archiveService: ArchiveService,
  ) {}

  async findById(id: string): Promise<ArchiveSubmissionEntity> {
    const submission = await this.prisma.archiveSubmission.findUnique({
      where: { id },
      select: archiveSubmissionSelect,
    });
    if (!submission) throw new NotFoundException('Archive submission not found');
    return mapArchiveSubmission(submission);
  }

  async findMany(params: {
    where: Prisma.ArchiveSubmissionWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.ArchiveSubmissionOrderByWithRelationInput;
  }): Promise<{ items: ArchiveSubmissionEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.archiveSubmission.findMany({ ...params, select: archiveSubmissionSelect }),
      this.prisma.archiveSubmission.count({ where: params.where }),
    ]);
    return { items: items.map(mapArchiveSubmission), total };
  }

  // Anti-duplikat identik (name) dalam window; Serializable menutup race insert (§8 poin 7).
  async create(
    data: CreateArchiveSubmissionData,
    duplicateWindowMs: number,
  ): Promise<ArchiveSubmissionEntity> {
    const since = new Date(Date.now() - duplicateWindowMs);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.archiveSubmission.findFirst({
            where: { name: data.name, createdAt: { gte: since } },
            select: { id: true },
          });
          if (duplicate) throw new ConflictException('Duplicate archive submission');
          const created = await tx.archiveSubmission.create({
            data: {
              name: data.name,
              description: data.description ?? null,
              thumbnail: data.thumbnail ?? null,
              externalLinks: data.externalLinks,
              attachmentIds: data.attachmentIds,
              status: ArchiveSubmissionStatus.REQUEST,
            },
            select: archiveSubmissionSelect,
          });
          return mapArchiveSubmission(created);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      // Serialization failure (race) → aman diperlakukan sebagai duplikat/kalah balapan.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        throw new ConflictException('Duplicate archive submission');
      }
      throw e;
    }
  }

  // Approve = transaksi atomik: conditional update → reassign attachment → create Archive DRAFT
  // → tautkan archiveId (§5.2.1). Gagal → rollback, submission tetap REQUEST.
  async approve(
    id: string,
    reviewerUserId: string,
    adminNote?: string,
  ): Promise<{ submission: ArchiveSubmissionEntity; archive: { id: string; status: ArchiveStatus } }> {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.archiveSubmission.updateMany({
        where: { id, status: ArchiveSubmissionStatus.REQUEST },
        data: {
          status: ArchiveSubmissionStatus.APPROVED,
          reviewedBy: reviewerUserId,
          reviewedAt: new Date(),
          adminNote: adminNote ?? null,
        },
      });
      if (res.count === 0) {
        const current = await tx.archiveSubmission.findUnique({ where: { id }, select: { status: true } });
        if (!current) throw new NotFoundException('Archive submission not found');
        throw new ConflictException(`Cannot approve archive submission in status ${current.status}`);
      }

      const submission = mapArchiveSubmission(
        await tx.archiveSubmission.findUniqueOrThrow({ where: { id }, select: archiveSubmissionSelect }),
      );

      // Attachment publik tersimpan `entityType='archive-submission'`, `entityId=null`.
      // Pindah ke `entityType='archive'` (entityId tetap null) agar `ArchiveService.create`
      // mem-bind row ke archive baru (ArchiveRepository.create → DocumentRepository.bind).
      await this.documentRepository.reassignEntityType(
        submission.attachmentIds,
        SUBMISSION_DOCUMENT_ENTITY_TYPE,
        ARCHIVE_DOCUMENT_ENTITY_TYPE,
        tx,
      );

      const archive = await this.archiveService.create(
        {
          name: submission.name,
          description: submission.description ?? undefined,
          thumbnail: submission.thumbnail ?? undefined,
          externalLinks: submission.externalLinks,
          status: ArchiveStatus.DRAFT,
          documentIds: submission.attachmentIds,
        },
        reviewerUserId,
        tx,
      );

      await tx.archiveSubmission.update({ where: { id }, data: { archiveId: archive.id } });
      const updated = mapArchiveSubmission(
        await tx.archiveSubmission.findUniqueOrThrow({ where: { id }, select: archiveSubmissionSelect }),
      );
      return { submission: updated, archive: { id: archive.id, status: ArchiveStatus.DRAFT } };
    });
  }

  // Conditional update REQUEST → REJECTED. `count === 0` → bedakan 404 vs 409.
  async reject(id: string, reviewerUserId: string, adminNote?: string): Promise<ArchiveSubmissionEntity> {
    const res = await this.prisma.archiveSubmission.updateMany({
      where: { id, status: ArchiveSubmissionStatus.REQUEST },
      data: {
        status: ArchiveSubmissionStatus.REJECTED,
        reviewedBy: reviewerUserId,
        reviewedAt: new Date(),
        adminNote: adminNote ?? null,
      },
    });
    if (res.count === 0) {
      const current = await this.prisma.archiveSubmission.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new NotFoundException('Archive submission not found');
      throw new ConflictException(`Cannot reject archive submission in status ${current.status}`);
    }
    return this.findById(id);
  }
}
