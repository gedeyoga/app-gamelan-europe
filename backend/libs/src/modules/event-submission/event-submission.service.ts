import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { EventSubmissionStatus, Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { CountryRepository } from '@app/libs/modules/country/country.repository';
import { StateRepository } from '@app/libs/modules/state/state.repository';
import { EventTypeRepository } from '@app/libs/modules/event-type/event-type.repository';
import { ImageService } from '@app/libs/modules/image/image.service';
import { EventSubmissionRepository, CreateEventSubmissionData } from './event-submission.repository';
import { EventSubmissionEntity } from './entities/event-submission.entity';
import { CreateEventSubmissionDto } from './dto/create-event-submission.dto';
import { ReviewEventSubmissionDto } from './dto/review-event-submission.dto';
import { ListEventSubmissionsQueryDto } from './dto/list-event-submissions-query.dto';

export const EVENT_SUBMISSION_SEARCHABLE_FIELDS = ['title', 'organiser'];
export const EVENT_SUBMISSION_SORT_FIELDS = ['title', 'status', 'startDate', 'createdAt', 'updatedAt'];
export const EVENT_SUBMISSION_FILTER_FIELDS = ['status', 'countryId', 'eventTypeId', 'createdAt', 'updatedAt'];
export const EVENT_SUBMISSION_DATE_FIELDS = ['startDate', 'endDate', 'reviewedAt', 'createdAt', 'updatedAt'];
export const EVENT_SUBMISSION_NUMBER_FIELDS = ['countryId', 'stateId'];

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const THUMBNAIL_ENTITY_TYPE = 'event-submission';

// "YYYY-MM-DD" (atau ISO apa pun) → Date UTC midnight; konsisten dengan kolom @db.Date.
function toUtcDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class EventSubmissionService {
  constructor(
    private readonly eventSubmissionRepository: EventSubmissionRepository,
    private readonly countryRepository: CountryRepository,
    private readonly stateRepository: StateRepository,
    private readonly eventTypeRepository: EventTypeRepository,
    private readonly imageService: ImageService,
  ) {}

  private validationError(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message }],
    });
  }

  async list(query: ListEventSubmissionsQueryDto): Promise<{ items: EventSubmissionEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, EVENT_SUBMISSION_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.EventSubmissionWhereInput>(
      query.filter,
      EVENT_SUBMISSION_FILTER_FIELDS,
      {
        enumFields: { status: ['REQUEST', 'APPROVED', 'REJECTED'] },
        dateFields: EVENT_SUBMISSION_DATE_FIELDS,
        numberFields: EVENT_SUBMISSION_NUMBER_FIELDS,
      },
    );
    const searchWhere = buildSearch<Prisma.EventSubmissionWhereInput>(
      query.search,
      EVENT_SUBMISSION_SEARCHABLE_FIELDS,
    );
    const where = combineWhere<Prisma.EventSubmissionWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.eventSubmissionRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.EventSubmissionOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  findOne(id: string): Promise<EventSubmissionEntity> {
    return this.eventSubmissionRepository.findById(id);
  }

  async create(dto: CreateEventSubmissionDto): Promise<{ id: string; status: EventSubmissionStatus }> {
    const country = await this.countryRepository.findByIdOrNull(dto.countryId);
    if (!country) throw this.validationError('countryId', 'countryId does not exist');

    if (dto.stateId !== undefined) {
      const state = await this.stateRepository.findByIdOrNull(dto.stateId);
      if (!state || state.countryId !== dto.countryId) {
        throw this.validationError('stateId', 'stateId must belong to countryId');
      }
    }

    const eventType = await this.eventTypeRepository.findByIdOrNull(dto.eventTypeId);
    if (!eventType) throw this.validationError('eventTypeId', 'eventTypeId does not exist');

    if (dto.thumbnail) {
      const trusted = await this.imageService.isTrustedUnboundUrl(dto.thumbnail, THUMBNAIL_ENTITY_TYPE);
      if (!trusted) {
        throw this.validationError('thumbnail', 'thumbnail must reference an uploaded EGS image');
      }
    }

    const data: CreateEventSubmissionData = {
      title: dto.title,
      startDate: toUtcDate(dto.startDate),
      endDate: toUtcDate(dto.endDate),
      countryId: dto.countryId,
      stateId: dto.stateId ?? null,
      organiser: dto.organiser,
      eventTypeId: dto.eventTypeId,
      shortDescription: dto.shortDescription,
      thumbnail: dto.thumbnail ?? null,
    };
    const created = await this.eventSubmissionRepository.create(data, DUPLICATE_WINDOW_MS);
    // Respons publik hanya { id, status } — tanpa echo row/PII (§8 poin 11).
    return { id: created.id, status: created.status };
  }

  async approve(
    id: string,
    reviewerUserId: string,
    dto: ReviewEventSubmissionDto = {},
  ): Promise<{ submission: EventSubmissionEntity; event: { id: string; slug: string; status: 'DRAFT' } }> {
    const { submission, event } = await this.eventSubmissionRepository.approve(id, reviewerUserId, dto.adminNote);
    return { submission, event: { id: event.id, slug: event.slug, status: 'DRAFT' } };
  }

  async reject(
    id: string,
    reviewerUserId: string,
    dto: ReviewEventSubmissionDto = {},
  ): Promise<EventSubmissionEntity> {
    return this.eventSubmissionRepository.reject(id, reviewerUserId, dto.adminNote);
  }
}
