import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, SubscriptionRequestType, NotificationEntityType, NotificationType } from '@prisma/client';
import {
  assertAllowedSort,
  buildOrderBy,
  buildSearch,
  buildWhere,
  combineWhere,
} from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { BillingService } from '@app/libs/modules/billing/billing.service';
import { BillingEntity } from '@app/libs/modules/billing/entities/billing.entity';
import { UserService } from '@app/libs/modules/user/user.service';
import { NotificationService } from '@app/libs/modules/notification/notification.service';
import { SubscriptionRequestRepository, SubscriptionRequestReviewRow } from './subscription-request.repository';
import { SubscriptionRequestEntity } from './entities/subscription-request.entity';
import { CreatePublicSubscriptionRequestDto } from './dto/create-public-subscription-request.dto';
import { CreateMySubscriptionRequestDto } from './dto/create-my-subscription-request.dto';

export const SUBSCRIPTION_REQUEST_SEARCHABLE_FIELDS = ['fullName', 'email', 'organisation'];
export const SUBSCRIPTION_REQUEST_SORT_FIELDS = [
  'fullName',
  'email',
  'status',
  'requestType',
  'createdAt',
  'updatedAt',
  'reviewedAt',
  'subscription.name',
];
export const SUBSCRIPTION_REQUEST_FILTER_FIELDS = [
  'status',
  'requestType',
  'userId',
  'subscriptionId',
  'email',
  'createdAt',
  'updatedAt',
];
export const SUBSCRIPTION_REQUEST_DATE_FIELDS = ['createdAt', 'updatedAt', 'reviewedAt'];
// sortBy kolom relasi → path nested Prisma.
export const SUBSCRIPTION_REQUEST_SORT_MAP: Record<string, string> = { 'subscription.name': 'subscription.name' };

@Injectable()
export class SubscriptionRequestService {
  constructor(
    private readonly subscriptionRequestRepository: SubscriptionRequestRepository,
    private readonly billingService: BillingService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  // Publik (tanpa akun): paket wajib ada & ACTIVE; field tidak valid → 422 per-field.
  async createPublic(dto: CreatePublicSubscriptionRequestDto): Promise<{ id: string; status: string }> {
    const subscription = await this.assertActiveSubscription(dto.subscriptionId);
    const created = await this.subscriptionRequestRepository.create({
      userId: null,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone ?? null,
      website: dto.website ?? null,
      address: dto.address ?? null,
      country: dto.country ?? null,
      organisation: dto.organisation ?? null,
      reason: dto.reason,
      subscriptionId: dto.subscriptionId,
      requestType: dto.requestType ?? 'NEW',
    });
    await this.notificationService.notifyAdmins({
      type: NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED,
      entityType: NotificationEntityType.SUBSCRIPTION_REQUEST,
      entityId: created.id,
      title: `${created.fullName} - ${subscription.name}`,
      details: [
        { label: 'Full name', value: created.fullName },
        { label: 'Email', value: created.email },
        { label: 'Phone', value: created.phone },
        { label: 'Organisation', value: created.organisation },
        { label: 'Package', value: subscription.name },
        { label: 'Request type', value: created.requestType },
        { label: 'Reason', value: created.reason },
      ],
      imageUrl: null,
      linkPath: `/subscription-requests/${created.id}`,
    });
    return { id: created.id, status: created.status };
  }

  // Member login: identitas dari user; RENEWAL bila masih punya membership aktif.
  async createMine(userId: string, dto: CreateMySubscriptionRequestDto): Promise<SubscriptionRequestEntity> {
    const user = await this.subscriptionRequestRepository.findUserContact(userId);
    if (!user) throw new NotFoundException('User not found');
    const subscription = await this.assertActiveSubscription(dto.subscriptionId);
    const requestType: SubscriptionRequestType = (await this.billingService.hasActiveMembership(userId))
      ? 'RENEWAL'
      : 'NEW';
    const created = await this.subscriptionRequestRepository.create({
      userId,
      fullName: user.fullName,
      email: user.email,
      phone: dto.phone ?? user.phone,
      website: dto.website ?? null,
      address: dto.address ?? user.address,
      country: dto.country ?? null,
      organisation: dto.organisation ?? null,
      reason: dto.reason,
      subscriptionId: dto.subscriptionId,
      requestType,
    });
    await this.notificationService.notifyAdmins({
      type: NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED,
      entityType: NotificationEntityType.SUBSCRIPTION_REQUEST,
      entityId: created.id,
      title: `${created.fullName} - ${subscription.name}`,
      details: [
        { label: 'Full name', value: created.fullName },
        { label: 'Email', value: created.email },
        { label: 'Phone', value: created.phone },
        { label: 'Organisation', value: created.organisation },
        { label: 'Package', value: subscription.name },
        { label: 'Request type', value: created.requestType },
        { label: 'Reason', value: created.reason },
      ],
      imageUrl: null,
      linkPath: `/subscription-requests/${created.id}`,
    });
    return created;
  }

  // Self-service: scoping dikunci ke user pemanggil; filter[userId] dari klien ditimpa.
  listMine(userId: string, query: ListQueryDto): Promise<{ items: SubscriptionRequestEntity[]; total: number }> {
    return this.list({ ...query, filter: { ...(query.filter ?? {}), userId } });
  }

  async list(query: ListQueryDto): Promise<{ items: SubscriptionRequestEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, SUBSCRIPTION_REQUEST_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.SubscriptionRequestWhereInput>(
      query.filter,
      SUBSCRIPTION_REQUEST_FILTER_FIELDS,
      {
        enumFields: {
          status: ['PENDING', 'APPROVED', 'REJECTED'],
          requestType: ['NEW', 'RENEWAL'],
        },
        dateFields: SUBSCRIPTION_REQUEST_DATE_FIELDS,
      },
    );
    const searchWhere = buildSearch<Prisma.SubscriptionRequestWhereInput>(
      query.search,
      SUBSCRIPTION_REQUEST_SEARCHABLE_FIELDS,
    );
    const where = combineWhere<Prisma.SubscriptionRequestWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.subscriptionRequestRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.SubscriptionRequestOrderByWithRelationInput>(
        query.sortBy,
        query.sortOrder,
        SUBSCRIPTION_REQUEST_SORT_MAP,
      ),
    });
  }

  findOne(id: string): Promise<SubscriptionRequestEntity> {
    return this.subscriptionRequestRepository.findById(id);
  }

  // Approve: claim atomik PENDING→APPROVED → resolve/buat user → billing PAID
  // → set billingId. PENDING-only guard mencegah double-approve (2 billing PAID).
  // Bukti pembayaran opsional diteruskan ke billing (trust-boundary divalidasi di subscribe).
  async approve(
    id: string,
    reviewerId: string,
    input: { note?: string; paymentProofUrl?: string; paymentProofName?: string } = {},
  ): Promise<SubscriptionRequestEntity> {
    const review = await this.subscriptionRequestRepository.findForReview(id);
    if (!review) throw new NotFoundException('Subscription request not found');
    const { count } = await this.subscriptionRequestRepository.claimPending(id, {
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote: input.note ?? null,
    });
    if (count === 0) {
      // Sudah diklaim proses lain / bukan PENDING; findById membedakan 404 vs 409.
      await this.subscriptionRequestRepository.findById(id);
      throw new ConflictException('Subscription request is not pending');
    }
    try {
      const subscription = await this.subscriptionRequestRepository.findActiveSubscription(review.subscriptionId);
      if (!subscription) throw new NotFoundException('Subscription not found');
      const userId = await this.resolveApproverUserId(review);
      const billing: BillingEntity = await this.billingService.subscribe({
        userId,
        subscriptionId: review.subscriptionId,
        ...(input.paymentProofUrl
          ? { paymentProofUrl: input.paymentProofUrl, paymentProofName: input.paymentProofName }
          : {}),
      });
      const updated = await this.subscriptionRequestRepository.setBillingId(id, billing.id);
      // SUBSCRIPTION_ACTIVE diemit BillingService.subscribe (sekali, best-effort).
      return updated;
    } catch (e) {
      // Compensating rollback: jangan tinggalkan request APPROVED tapi billing orphan/gagal.
      // ponytail: claim + create billing belum satu transaksi; upgrade ke prisma.$transaction bila perlu atomik penuh.
      await this.subscriptionRequestRepository.revertPending(id);
      throw e;
    }
  }

  async reject(id: string, reviewerId: string, note?: string): Promise<SubscriptionRequestEntity> {
    const review = await this.subscriptionRequestRepository.findForReview(id);
    if (!review) throw new NotFoundException('Subscription request not found');
    const { count } = await this.subscriptionRequestRepository.claimRejected(id, {
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote: note ?? null,
    });
    if (count === 0) {
      // Sejajar approve: reject vs approve tidak balapan (claim atomik).
      await this.subscriptionRequestRepository.findById(id);
      throw new ConflictException('Subscription request is not pending');
    }
    return this.subscriptionRequestRepository.findById(id);
  }

  private async resolveApproverUserId(review: SubscriptionRequestReviewRow): Promise<string> {
    const user = review.userId
      ? await this.subscriptionRequestRepository.findUserContact(review.userId)
      : await this.userService.findOrCreatePublicUser({ fullName: review.fullName, email: review.email });
    if (!user) throw new NotFoundException('User not found');
    // ponytail: isi role `member` HANYA bila user belum punya role — jangan downgrade role existing.
    // Upgrade bila perlu menegakkan role member eksplisit.
    if (user.roleId === null) {
      const member = await this.subscriptionRequestRepository.findRoleIdByCode('member');
      if (member) await this.subscriptionRequestRepository.setUserRole(user.id, member.id);
    }
    return user.id;
  }

  private async assertActiveSubscription(subscriptionId: string): Promise<{ id: string; name: string }> {
    const subscription = await this.subscriptionRequestRepository.findActiveSubscription(subscriptionId);
    if (!subscription) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: [{ field: 'subscriptionId', message: 'subscription not found or inactive' }],
      });
    }
    return subscription;
  }
}
