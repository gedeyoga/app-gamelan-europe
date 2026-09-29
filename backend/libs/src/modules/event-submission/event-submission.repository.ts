import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, ContentVisibility, EventSubmissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { EventRepository, CreateEventData } from '@app/libs/modules/event/event.repository';
import { slugify } from '@app/libs/modules/event/utils/slug.util';
import { escapeHtml } from '@app/libs/common/utils/html.util';
import { NetworkService } from '@app/libs/modules/network/network.service';
import { eventSubmissionSelect, EventSubmissionEntity, mapEventSubmission } from './entities/event-submission.entity';
import { MAX_EVENT_SUBMISSION_RANGE_DAYS } from './dto/create-event-submission.dto';

export interface CreateEventSubmissionData {
  title: string;
  startDate: Date;
  endDate: Date;
  countryId: number;
  stateId?: number | null;
  organiser: string;
  authorFullName: string;
  authorEmail: string;
  authorCountryId: number;
  authorStateId?: number | null;
  eventTypeId?: string | null;
  shortDescription: string;
  thumbnail?: string | null;
}

// Satu EventDate per hari inklusif; cap `MAX_EVENT_SUBMISSION_RANGE_DAYS` (§8 poin 8).
function enumerateDates(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (cursor.getTime() <= last && dates.length < MAX_EVENT_SUBMISSION_RANGE_DAYS) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

@Injectable()
export class EventSubmissionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventRepository: EventRepository,
    private readonly networkService: NetworkService,
  ) {}

  async findById(id: string): Promise<EventSubmissionEntity> {
    const submission = await this.prisma.eventSubmission.findUnique({ where: { id }, select: eventSubmissionSelect });
    if (!submission) throw new NotFoundException('Event submission not found');
    return mapEventSubmission(submission);
  }

  async findMany(params: {
    where: Prisma.EventSubmissionWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.EventSubmissionOrderByWithRelationInput;
  }): Promise<{ items: EventSubmissionEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eventSubmission.findMany({ ...params, select: eventSubmissionSelect }),
      this.prisma.eventSubmission.count({ where: params.where }),
    ]);
    return { items: items.map(mapEventSubmission), total };
  }

  // Anti-duplikat identik (title+startDate+countryId) dalam window; Serializable menutup race insert (§8 poin 7).
  async create(data: CreateEventSubmissionData, duplicateWindowMs: number): Promise<EventSubmissionEntity> {
    const since = new Date(Date.now() - duplicateWindowMs);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.eventSubmission.findFirst({
            where: {
              title: data.title,
              startDate: data.startDate,
              countryId: data.countryId,
              createdAt: { gte: since },
            },
            select: { id: true },
          });
          if (duplicate) throw new ConflictException('Duplicate event submission');
          const created = await tx.eventSubmission.create({
            data: {
              title: data.title,
              startDate: data.startDate,
              endDate: data.endDate,
              countryId: data.countryId,
              stateId: data.stateId ?? null,
              organiser: data.organiser,
              authorFullName: data.authorFullName,
              authorEmail: data.authorEmail,
              authorCountryId: data.authorCountryId,
              authorStateId: data.authorStateId ?? null,
              eventTypeId: data.eventTypeId ?? null,
              shortDescription: data.shortDescription,
              thumbnail: data.thumbnail ?? null,
              status: EventSubmissionStatus.REQUEST,
            },
            select: eventSubmissionSelect,
          });
          return mapEventSubmission(created);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      // Serialization failure (race) → aman diperlakukan sebagai duplikat/kalah balapan.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        throw new ConflictException('Duplicate event submission');
      }
      throw e;
    }
  }

  // Conditional update REQUEST → final. `count === 0` → bedakan 404 vs 409.
  private async updateStatusFinal(
    id: string,
    to: EventSubmissionStatus,
    reviewerUserId: string,
    adminNote?: string,
  ): Promise<void> {
    const res = await this.prisma.eventSubmission.updateMany({
      where: { id, status: EventSubmissionStatus.REQUEST },
      data: {
        status: to,
        reviewedBy: reviewerUserId,
        reviewedAt: new Date(),
        adminNote: adminNote ?? null,
      },
    });
    if (res.count === 0) {
      const current = await this.prisma.eventSubmission.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new NotFoundException('Event submission not found');
      const action = to === EventSubmissionStatus.APPROVED ? 'approve' : 'reject';
      throw new ConflictException(`Cannot ${action} event submission in status ${current.status}`);
    }
  }

  // Approve = transaksi atomik: conditional update → find-or-create Network → create Event DRAFT
  // + relasi → tautkan eventId (§5.2.1). Gagal → rollback, submission tetap REQUEST.
  async approve(
    id: string,
    reviewerUserId: string,
    adminNote?: string,
  ): Promise<{ submission: EventSubmissionEntity; event: { id: string; slug: string } }> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const res = await tx.eventSubmission.updateMany({
            where: { id, status: EventSubmissionStatus.REQUEST },
            data: {
              status: EventSubmissionStatus.APPROVED,
              reviewedBy: reviewerUserId,
              reviewedAt: new Date(),
              adminNote: adminNote ?? null,
            },
          });
          if (res.count === 0) {
            const current = await tx.eventSubmission.findUnique({ where: { id }, select: { status: true } });
            if (!current) throw new NotFoundException('Event submission not found');
            throw new ConflictException(`Cannot approve event submission in status ${current.status}`);
          }

          const submission = mapEventSubmission(
            await tx.eventSubmission.findUniqueOrThrow({ where: { id }, select: eventSubmissionSelect }),
          );

          const network = await this.networkService.findOrCreateByName(submission.organiser, {
            state: submission.state?.name ?? null,
            country: submission.country?.name ?? null,
            tx,
          });

          const baseSlug = slugify(submission.title);
          let slug = baseSlug;
          for (let i = 2; await this.eventRepository.existsBySlug(slug, tx); i++) {
            slug = `${baseSlug}-${i}`;
          }

          const event = await this.eventRepository.createInTransaction(
            tx,
            this.buildEventData(submission, reviewerUserId, network.id, slug),
          );

          await tx.eventSubmission.update({ where: { id }, data: { eventId: event.id } });
          const updated = mapEventSubmission(
            await tx.eventSubmission.findUniqueOrThrow({ where: { id }, select: eventSubmissionSelect }),
          );
          return { submission: updated, event: { id: event.id, slug: event.slug } };
        });
      } catch (e) {
        // P2002 = slug event kalah race; transaksi sudah rollback (submission tetap REQUEST) → ulang.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException('Slug already exists');
  }

  async reject(id: string, reviewerUserId: string, adminNote?: string): Promise<EventSubmissionEntity> {
    await this.updateStatusFinal(id, EventSubmissionStatus.REJECTED, reviewerUserId, adminNote);
    return this.findById(id);
  }

  private buildEventData(
    submission: EventSubmissionEntity,
    reviewerUserId: string,
    networkId: string,
    slug: string,
  ): CreateEventData {
    const countryName = submission.country?.name ?? '';
    const stateName = submission.state?.name ?? null;
    return {
      name: submission.title,
      slug,
      content: `<p>${escapeHtml(submission.shortDescription)}</p>`,
      thumbnail: submission.thumbnail ?? undefined,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PUBLIC,
      createdBy: reviewerUserId,
      networkId,
      eventTypeIds: submission.eventTypeId ? [submission.eventTypeId] : [],
      dates: enumerateDates(submission.startDate, submission.endDate).map((date) => ({
        date,
        startTime: undefined,
        endTime: undefined,
      })),
      location: {
        name: stateName ?? countryName,
        address: stateName ? `${stateName}, ${countryName}` : countryName,
      },
    };
  }
}
