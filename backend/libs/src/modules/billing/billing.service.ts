import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import {
  buildWhere,
  assertAllowedSort,
  buildSearch,
  combineWhere,
  buildOrderBy,
} from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { BillingRepository } from './billing.repository';
import { BillingEntity, MemberSubscription, mapMemberSubscription } from './entities/billing.entity';
import { CreateBillingDto } from './dto/create-billing.dto';
import { UpdateBillingDto } from './dto/update-billing.dto';
import { BillingLineDto } from './dto/billing-line.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { SubscribeBillingDto } from './dto/subscribe-billing.dto';
import {
  PAYMENT_PROOF_ALLOWED_MIME,
  PAYMENT_PROOF_EXT_MIME,
  PAYMENT_PROOF_GENERIC_MIME,
  PAYMENT_PROOF_MIME_EXT,
} from '@app/libs/common/constants/payment-proof';

// Magic-byte dasar (mirror DocumentService PDF check) — tolak file yang isinya
// tak cocok dengan MIME/ekstensi yang diklaim.
const PROOF_MAGIC: Record<string, (buf: Buffer) => boolean> = {
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length >= 4 && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/webp': (b) =>
    b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

// Kontrak upload bukti bayar. `url` dihitung dari key + `S3_PUBLIC_BASE_URL`; tanpa baris DB.
export interface PaymentProofResponse {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export const BILLING_SEARCHABLE_FIELDS = ['code', 'currency'];
export const BILLING_SORT_FIELDS = [
  'code',
  'status',
  'subscriptionType',
  'currency',
  'total',
  'paidAt',
  'canceledAt',
  'startDate',
  'expiryDate',
  'createdAt',
  'updatedAt',
  'user.fullName',
  'subscription.name',
];
export const BILLING_FILTER_FIELDS = [
  'code',
  'status',
  'subscriptionType',
  'currency',
  'userId',
  'subscriptionId',
  'paidAt',
  'canceledAt',
  'startDate',
  'expiryDate',
  'createdAt',
  'updatedAt',
];
export const BILLING_DATE_FIELDS = ['paidAt', 'canceledAt', 'startDate', 'expiryDate', 'createdAt', 'updatedAt'];

// List /billings/members: cari di user, sort kolom komputasi.
const MEMBER_SEARCHABLE_FIELDS = ['fullName', 'email'];
export const MEMBER_SORT_FIELDS = [
  'fullName',
  'user.fullName',
  'email',
  'subscription.name',
  'startDate',
  'expiryDate',
  'status',
  'createdAt',
];

interface DecoratedMember {
  member: MemberSubscription;
  createdAt: number;
}

function compareNullableDate(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1; // null di akhir (asc)
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

function compareMembers(a: DecoratedMember, b: DecoratedMember, sortBy: string): number {
  switch (sortBy) {
    case 'email':
      return a.member.user.email.localeCompare(b.member.user.email);
    case 'subscription.name':
      // null-safe: member tanpa billing → nama paket '' (di akhir pada asc).
      return (a.member.subscription?.name ?? '').localeCompare(b.member.subscription?.name ?? '');
    case 'startDate':
      return compareNullableDate(a.member.startDate, b.member.startDate);
    case 'expiryDate':
      return compareNullableDate(a.member.expiryDate, b.member.expiryDate);
    case 'status':
      return a.member.status.localeCompare(b.member.status);
    case 'createdAt':
      return a.createdAt - b.createdAt;
    default:
      // 'fullName' & 'user.fullName' → field user yang sama.
      return a.member.user.fullName.localeCompare(b.member.user.fullName);
  }
}

// sortBy kolom relasi → path nested Prisma (satu level).
export const BILLING_SORT_MAP: Record<string, string> = {
  'user.fullName': 'user.fullName',
  'subscription.name': 'subscription.name',
};

@Injectable()
export class BillingService {
  constructor(
    private readonly billingRepository: BillingRepository,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  private invalid(message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field: 'file', message }],
    });
  }

  private invalidProof(message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field: 'paymentProofUrl', message }],
    });
  }

  private normalizeProofMime(file: Express.Multer.File): string | null {
    const mime = file.mimetype.toLowerCase();
    if (PAYMENT_PROOF_ALLOWED_MIME.includes(mime)) return mime;
    if (!PAYMENT_PROOF_GENERIC_MIME.includes(mime)) return null;
    const name = file.originalname.toLowerCase();
    return PAYMENT_PROOF_EXT_MIME[name.slice(name.lastIndexOf('.') + 1)] ?? null;
  }

  // Upload bukti bayar (gambar/PDF). Tanpa baris DB; URL dikirim balik untuk disimpan di Billing.
  async uploadPaymentProof(file: Express.Multer.File | undefined): Promise<PaymentProofResponse> {
    if (!file) throw this.invalid('file is required');
    const mimeType = this.normalizeProofMime(file);
    if (!mimeType) throw this.invalid('unsupported mime type');
    const maxMb = Number(this.config.get('UPLOAD_DOCUMENT_MAX_SIZE_MB') ?? 10);
    if (file.size > maxMb * 1024 * 1024) throw this.invalid('file too large');
    if (!PROOF_MAGIC[mimeType]?.(file.buffer)) throw this.invalid('file content does not match its declared type');
    const key = `billing/payment-proof/${randomUUID()}.${PAYMENT_PROOF_MIME_EXT[mimeType]}`;
    await this.storage.upload(key, file.buffer, mimeType);
    const base = this.config.getOrThrow<string>('S3_PUBLIC_BASE_URL').replace(/\/+$/, '');
    return { url: `${base}/${key}`, filename: file.originalname, mimeType, size: file.size };
  }

  private toLineData(line: BillingLineDto): Prisma.BillingLineCreateManyBillingInput {
    return {
      description: line.description,
      type: line.type,
      amount: line.amount,
      currency: line.currency,
      ...(line.qty !== undefined ? { qty: line.qty } : {}),
    };
  }

  async list(query: ListQueryDto): Promise<{ items: BillingEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, BILLING_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.BillingWhereInput>(query.filter, BILLING_FILTER_FIELDS, {
      enumFields: {
        status: ['PENDING', 'PAID', 'CANCELED'],
        subscriptionType: ['MONTHLY', 'YEARLY'],
      },
      dateFields: BILLING_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.BillingWhereInput>(query.search, BILLING_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.BillingWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.billingRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.BillingOrderByWithRelationInput>(query.sortBy, query.sortOrder, BILLING_SORT_MAP),
    });
  }

  // Self-service: scoping dikunci ke user pemanggil; filter[userId] dari klien ditimpa.
  findMine(userId: string, query: ListQueryDto): Promise<{ items: BillingEntity[]; total: number }> {
    return this.list({ ...query, filter: { ...(query.filter ?? {}), userId } });
  }

  // List member (role.code = 'member') + billing terbaru. Sort/paginasi in-memory karena `status`
  // & `expiryDate` berasal dari billing terbaru (bukan kolom user) → tak bisa orderBy langsung.
  // ponytail: load semua member; pindah ke SQL (window/join) bila populasi besar.
  async listMembers(query: ListMembersQueryDto): Promise<{ items: MemberSubscription[]; total: number }> {
    assertAllowedSort(query.sortBy, MEMBER_SORT_FIELDS);
    const searchWhere = buildSearch<Prisma.UserWhereInput>(query.search, MEMBER_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.UserWhereInput>(
      { role: { code: 'member' } },
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    const rows = await this.billingRepository.findMembers(where);
    const now = new Date();
    const decorated: DecoratedMember[] = rows.map((row) => ({
      member: mapMemberSubscription(row, now),
      createdAt: row.createdAt.getTime(),
    }));
    const dir = query.sortOrder === 'desc' ? -1 : 1;
    decorated.sort((a, b) => dir * compareMembers(a, b, query.sortBy));
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    return { items: decorated.slice(skip, skip + take).map((d) => d.member), total: decorated.length };
  }

  // Berlangganan: cek user & subscription (404), lalu transaksi batal-lama + billing-baru.
  async subscribe(dto: SubscribeBillingDto): Promise<BillingEntity> {
    const subscription = await this.billingRepository.findSubscription(dto.subscriptionId);
    await this.billingRepository.findUser(dto.userId);
    if (dto.paymentProofUrl) {
      // Trust boundary: bukti hanya boleh menunjuk objek yang kita hosting (cegah URL eksternal/phishing).
      // Tanpa S3_PUBLIC_BASE_URL (dev tanpa S3) lewati cek prefix agar tidak 500.
      const base = this.config.get<string>('S3_PUBLIC_BASE_URL')?.replace(/\/+$/, '');
      if (base && !dto.paymentProofUrl.startsWith(`${base}/`)) {
        throw this.invalidProof('paymentProofUrl must point to an uploaded payment proof');
      }
    }
    const now = new Date();
    const expiryDate = new Date(now.getTime() + subscription.durationInDays * 86_400_000);
    return this.billingRepository.subscribe({
      userId: dto.userId,
      subscriptionId: dto.subscriptionId,
      subscriptionType: subscription.subscriptionType,
      currency: subscription.currency,
      total: Number(subscription.price),
      startDate: now,
      expiryDate,
      now,
      paymentProofUrl: dto.paymentProofUrl,
      paymentProofName: dto.paymentProofName,
    });
  }

  hasActiveMembership(userId: string): Promise<boolean> {
    return this.billingRepository.hasActiveByUser(userId, new Date());
  }

  cancel(id: string): Promise<BillingEntity> {
    return this.billingRepository.cancel(id);
  }

  findOne(id: string): Promise<BillingEntity> {
    return this.billingRepository.findById(id);
  }

  create(dto: CreateBillingDto): Promise<BillingEntity> {
    const data: Prisma.BillingCreateInput = {
      user: { connect: { id: dto.userId } },
      subscription: { connect: { id: dto.subscriptionId } },
      code: dto.code,
      subscriptionType: dto.subscriptionType,
      currency: dto.currency,
      total: dto.total,
      lines: { create: dto.lines.map((line) => this.toLineData(line)) },
    };
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.discount !== undefined) data.discount = dto.discount;
    if (dto.tax !== undefined) data.tax = dto.tax;
    if (dto.paidAt !== undefined) data.paidAt = dto.paidAt === null ? null : new Date(dto.paidAt);
    if (dto.canceledAt !== undefined) data.canceledAt = dto.canceledAt === null ? null : new Date(dto.canceledAt);
    return this.billingRepository.create(data);
  }

  update(id: string, dto: UpdateBillingDto): Promise<BillingEntity> {
    const data: Prisma.BillingUpdateInput = {};
    if (dto.userId !== undefined) data.user = { connect: { id: dto.userId } };
    if (dto.subscriptionId !== undefined) data.subscription = { connect: { id: dto.subscriptionId } };
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.subscriptionType !== undefined) data.subscriptionType = dto.subscriptionType;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.total !== undefined) data.total = dto.total;
    if (dto.discount !== undefined) data.discount = dto.discount;
    if (dto.tax !== undefined) data.tax = dto.tax;
    if (dto.paidAt !== undefined) data.paidAt = dto.paidAt === null ? null : new Date(dto.paidAt);
    if (dto.canceledAt !== undefined) data.canceledAt = dto.canceledAt === null ? null : new Date(dto.canceledAt);

    const lines = dto.lines !== undefined ? dto.lines.map((line) => this.toLineData(line)) : undefined;
    if (Object.keys(data).length === 0 && lines === undefined) {
      return this.findOne(id);
    }
    return this.billingRepository.update(id, data, lines);
  }

  remove(id: string): Promise<BillingEntity> {
    return this.billingRepository.remove(id);
  }
}
