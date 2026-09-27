import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ArchiveStatus, ArchiveSubmissionStatus, Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { DocumentRepository } from '@app/libs/modules/document/document.repository';
import { DocumentService, DocumentResponse } from '@app/libs/modules/document/document.service';
import { ImageService } from '@app/libs/modules/image/image.service';
import {
  ArchiveSubmissionRepository,
  CreateArchiveSubmissionData,
} from './archive-submission.repository';
import {
  ArchiveSubmissionEntity,
  ArchiveSubmissionListItem,
  ArchiveSubmissionResponse,
} from './entities/archive-submission.entity';
import { CreateArchiveSubmissionDto } from './dto/create-archive-submission.dto';
import { ReviewArchiveSubmissionDto } from './dto/review-archive-submission.dto';
import { ListArchiveSubmissionsQueryDto } from './dto/list-archive-submissions-query.dto';

export const ARCHIVE_SUBMISSION_SEARCHABLE_FIELDS = ['name', 'description'];
export const ARCHIVE_SUBMISSION_SORT_FIELDS = ['name', 'status', 'createdAt', 'updatedAt'];
export const ARCHIVE_SUBMISSION_FILTER_FIELDS = ['status', 'reviewedAt', 'createdAt', 'updatedAt'];
export const ARCHIVE_SUBMISSION_DATE_FIELDS = ['reviewedAt', 'createdAt', 'updatedAt'];

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const SUBMISSION_ENTITY_TYPE = 'archive-submission';

@Injectable()
export class ArchiveSubmissionService {
  constructor(
    private readonly archiveSubmissionRepository: ArchiveSubmissionRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly documentService: DocumentService,
    private readonly imageService: ImageService,
  ) {}

  private validationError(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message }],
    });
  }

  // Item list: buang `attachmentIds` mentah, ekspos `attachmentCount` (hindari N+1).
  private toListItem(submission: ArchiveSubmissionEntity): ArchiveSubmissionListItem {
    const { attachmentIds, ...item } = submission;
    return { ...item, attachmentCount: attachmentIds.length };
  }

  // Resolve `attachmentIds` → `attachments: DocumentResponse[]` berurut; raw id tidak dibocorkan ke FE.
  private async hydrate(submission: ArchiveSubmissionEntity): Promise<ArchiveSubmissionResponse> {
    const { attachmentIds, ...rest } = submission;
    const documents = await this.documentRepository.findByIds(attachmentIds);
    const byId = new Map(documents.map((document) => [document.id, document]));
    return {
      ...rest,
      attachments: attachmentIds
        .map((id) => byId.get(id))
        .filter((document): document is NonNullable<typeof document> => Boolean(document))
        .map((document) => this.documentService.toDocumentResponse(document)),
    };
  }

  async list(
    query: ListArchiveSubmissionsQueryDto,
  ): Promise<{ items: ArchiveSubmissionListItem[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, ARCHIVE_SUBMISSION_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.ArchiveSubmissionWhereInput>(
      query.filter,
      ARCHIVE_SUBMISSION_FILTER_FIELDS,
      {
        enumFields: { status: ['REQUEST', 'APPROVED', 'REJECTED'] },
        dateFields: ARCHIVE_SUBMISSION_DATE_FIELDS,
      },
    );
    const searchWhere = buildSearch<Prisma.ArchiveSubmissionWhereInput>(
      query.search,
      ARCHIVE_SUBMISSION_SEARCHABLE_FIELDS,
    );
    const where = combineWhere<Prisma.ArchiveSubmissionWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    const { items, total } = await this.archiveSubmissionRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.ArchiveSubmissionOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
    return { items: items.map((item) => this.toListItem(item)), total };
  }

  async findOne(id: string): Promise<ArchiveSubmissionResponse> {
    return this.hydrate(await this.archiveSubmissionRepository.findById(id));
  }

  async create(dto: CreateArchiveSubmissionDto): Promise<{ id: string; status: ArchiveSubmissionStatus }> {
    // Setiap attachment wajib ada, bertipe submission, & belum ter-bind ke entity lain.
    if (dto.attachments && dto.attachments.length > 0) {
      const documents = await this.documentRepository.findByIds(dto.attachments);
      const byId = new Map(documents.map((document) => [document.id, document]));
      for (let i = 0; i < dto.attachments.length; i++) {
        const document = byId.get(dto.attachments[i]);
        if (!document || document.entityType !== SUBMISSION_ENTITY_TYPE || document.entityId !== null) {
          throw this.validationError(
            `attachments.${i}`,
            'attachment not found, wrong type, or already bound',
          );
        }
      }
    }

    if (dto.thumbnail) {
      const trusted = await this.imageService.isTrustedUnboundUrl(dto.thumbnail, SUBMISSION_ENTITY_TYPE);
      if (!trusted) {
        throw this.validationError('thumbnail', 'thumbnail must reference an uploaded EGS image');
      }
    }

    const data: CreateArchiveSubmissionData = {
      name: dto.name,
      description: dto.description ?? null,
      thumbnail: dto.thumbnail ?? null,
      externalLinks: dto.externalLinks ?? [],
      attachmentIds: dto.attachments ?? [],
    };
    const created = await this.archiveSubmissionRepository.create(data, DUPLICATE_WINDOW_MS);
    // Respons publik hanya { id, status } — tanpa echo row/PII (§8 poin 11).
    return { id: created.id, status: created.status };
  }

  async approve(
    id: string,
    reviewerUserId: string,
    dto: ReviewArchiveSubmissionDto = {},
  ): Promise<{ submission: ArchiveSubmissionListItem; archive: { id: string; status: ArchiveStatus } }> {
    const { submission, archive } = await this.archiveSubmissionRepository.approve(
      id,
      reviewerUserId,
      dto.adminNote,
    );
    return { submission: this.toListItem(submission), archive };
  }

  async reject(
    id: string,
    reviewerUserId: string,
    dto: ReviewArchiveSubmissionDto = {},
  ): Promise<ArchiveSubmissionListItem> {
    return this.toListItem(await this.archiveSubmissionRepository.reject(id, reviewerUserId, dto.adminNote));
  }
}
