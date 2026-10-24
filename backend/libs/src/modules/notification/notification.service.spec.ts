import { Logger } from '@nestjs/common';
import {
  BillingStatus,
  NotificationChannel,
  NotificationEntityType,
  NotificationType,
  UserStatus,
} from '@prisma/client';
import { NotificationRepository, buildRecipientWhere } from './notification.repository';
import { NotificationService } from './notification.service';

function makeService(
  overrides: {
    repository?: Record<string, unknown>;
    queue?: Record<string, unknown>;
  } = {},
) {
  const repository = {
    findAuthorIds: jest.fn().mockResolvedValue([]),
    findRecipientIds: jest.fn().mockResolvedValue(['u1']),
    findAdminRecipientIds: jest.fn().mockResolvedValue(['admin1']),
    createMany: jest.fn().mockResolvedValue(1),
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    findManyForUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    markRead: jest.fn(),
    markAllRead: jest.fn().mockResolvedValue(2),
    findPreferences: jest.fn().mockResolvedValue([]),
    upsertPreference: jest.fn().mockResolvedValue({
      type: NotificationType.CONTENT_PUBLISHED,
      channel: NotificationChannel.EMAIL,
      emailEnabled: false,
    }),
    ...overrides.repository,
  };
  const queue = { enqueuePending: jest.fn().mockResolvedValue(undefined), ...overrides.queue };
  const service = new NotificationService(repository as never, queue as never);
  return { service, repository, queue };
}

const now = new Date('2026-10-19T12:00:00.000Z');

function input(overrides: Record<string, unknown> = {}) {
  return {
    entityType: NotificationEntityType.POST,
    entityId: 'p1',
    title: 'Judul',
    body: '<p>Isi <b>berita</b></p>',
    imageUrl: 'https://cdn.example.com/a.jpg',
    slug: 'judul-berita',
    publishedAt: now,
    actorId: 'creator',
    ...overrides,
  };
}

describe('NotificationService.enqueueContentPublished', () => {  beforeEach(() => jest.useFakeTimers().setSystemTime(now));
  afterEach(() => jest.useRealTimers());

  it('notify=false → tidak query/create row', async () => {
    const { service, repository } = makeService();
    await expect(service.enqueueContentPublished({} as never, input({ notify: false }) as never)).resolves.toBe(0);
    expect(repository.findAuthorIds).not.toHaveBeenCalled();
    expect(repository.findRecipientIds).not.toHaveBeenCalled();
    expect(repository.createMany).not.toHaveBeenCalled();
  });

  it('default notify (undefined) → row dibuat', async () => {
    const { service, repository } = makeService();
    await service.enqueueContentPublished({} as never, input() as never);
    expect(repository.createMany).toHaveBeenCalledTimes(1);
  });

  it('membuat row dengan excerpt plain text + linkPath slug', async () => {
    const { service, repository } = makeService();
    await service.enqueueContentPublished({} as never, input() as never);
    const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      userId: 'u1',
      entityType: NotificationEntityType.POST,
      entityId: 'p1',
      title: 'Judul',
      body: 'Isi berita',
      imageUrl: 'https://cdn.example.com/a.jpg',
      linkPath: '/stories/judul-berita',
    });
  });

  it('publishedAt masa depan → scheduledAt = publishedAt', async () => {
    const future = new Date(now.getTime() + 3_600_000);
    const { service, repository } = makeService();
    await service.enqueueContentPublished({} as never, input({ publishedAt: future }) as never);
    const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows[0].scheduledAt).toEqual(future);
  });

  it('publishedAt lampau → scheduledAt = now', async () => {
    const past = new Date(now.getTime() - 3_600_000);
    const { service, repository } = makeService();
    await service.enqueueContentPublished({} as never, input({ publishedAt: past }) as never);
    const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows[0].scheduledAt).toEqual(now);
  });

  it('Archive MEMBER → recipient difilter membership aktif', async () => {
    const { service, repository } = makeService();
    await service.enqueueContentPublished(
      {} as never,
      input({ entityType: NotificationEntityType.ARCHIVE, archiveType: 'MEMBER' }) as never,
    );
    expect(repository.findRecipientIds).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ memberOnly: true }),
    );
  });
});

describe('NotificationService.publishAfterCommit', () => {
  it('notify=false → tidak buka transaksi / enqueue job', async () => {
    const { service, repository, queue } = makeService();
    await service.publishAfterCommit(input({ notify: false }) as never);
    expect(repository.transaction).not.toHaveBeenCalled();
    expect(queue.enqueuePending).not.toHaveBeenCalled();
  });

  it('default → transaksi + enqueue job', async () => {
    const { service, repository, queue } = makeService();
    await service.publishAfterCommit(input() as never);
    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(queue.enqueuePending).toHaveBeenCalledWith(NotificationEntityType.POST, 'p1');
  });
});

describe('buildRecipientWhere', () => {
  it('mengecualikan creator + author konten', () => {
    const where = buildRecipientWhere({ creatorId: 'creator', authorIds: ['a1', 'a2'], memberOnly: false, now });
    expect(where.id).toEqual({ notIn: ['creator', 'a1', 'a2'] });
  });

  it('hanya ACTIVE + role member/author + preferensi email tidak false', () => {
    const where = buildRecipientWhere({ authorIds: [], memberOnly: false, now });
    expect(where.status).toBe(UserStatus.ACTIVE);
    expect(where.role).toEqual({ code: { in: ['member', 'author'] } });
    expect(where.notificationPreferences).toEqual({
      none: {
        type: NotificationType.CONTENT_PUBLISHED,
        channel: NotificationChannel.EMAIL,
        emailEnabled: false,
      },
    });
    expect(where.billings).toBeUndefined();
  });

  it('ARCHIVE MEMBER → billing PAID belum expiry', () => {
    const where = buildRecipientWhere({ authorIds: [], memberOnly: true, now });
    expect(where.billings).toEqual({
      some: { status: BillingStatus.PAID, expiryDate: { gt: now } },
    });
  });
});

describe('NotificationService.publishAfterCommit', () => {
  it('insert di transaksi lalu enqueue setelah commit', async () => {
    const { service, repository, queue } = makeService();
    await service.publishAfterCommit(input() as never);
    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(queue.enqueuePending).toHaveBeenCalledWith(NotificationEntityType.POST, 'p1');
  });

  it('queue gagal → tidak melempar (publish tetap sukses)', async () => {
    const { service } = makeService({
      queue: { enqueuePending: jest.fn().mockRejectedValue(new Error('redis down')) },
    });
    await expect(service.publishAfterCommit(input() as never)).resolves.toBeUndefined();
  });

  it('insert gagal → tidak melempar', async () => {
    const { service } = makeService({
      repository: {
        transaction: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    await expect(service.publishAfterCommit(input() as never)).resolves.toBeUndefined();
  });
});

describe('NotificationService.notifyAdmins', () => {
  const input = {
    type: NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED,
    entityType: NotificationEntityType.SUBSCRIPTION_REQUEST,
    entityId: 's1',
    title: 'Budi - Basic',
    linkPath: '/subscription-requests/s1',
  };

  it('membuat row untuk admin ACTIVE lalu enqueue', async () => {
    const { service, repository, queue } = makeService();
    await service.notifyAdmins(input);

    expect(repository.findAdminRecipientIds).toHaveBeenCalledWith(expect.anything(), input.type);
    const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      userId: 'admin1',
      type: input.type,
      entityType: input.entityType,
      entityId: 's1',
      title: 'Budi - Basic',
      imageUrl: null,
      linkPath: '/subscription-requests/s1',
    });
    expect(queue.enqueuePending).toHaveBeenCalledWith(input.entityType, 's1');
  });

  it('detail disimpan sebagai baris Label: value (HTML di-strip, newline dipertahankan)', async () => {
    const { service, repository } = makeService();
    await service.notifyAdmins({
      ...input,
      details: [
        { label: 'Full name', value: '  <b>Budi</b>  ' },
        { label: 'Phone', value: null },
        { label: 'Email', value: 'a@b.c' },
      ],
    });
    const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows[0].body).toBe('Full name: Budi\nEmail: a@b.c');
  });

  it('details kosong → fallback excerpt body', async () => {
    const { service, repository } = makeService();
    await service.notifyAdmins({ ...input, body: '<p>Isi</p>', details: [] });
    const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows[0].body).toBe('Isi');
  });

  it('tanpa admin → tidak membuat row / enqueue', async () => {
    const { service, repository, queue } = makeService({
      repository: { findAdminRecipientIds: jest.fn().mockResolvedValue([]) },
    });
    await service.notifyAdmins(input);
    expect(repository.createMany).not.toHaveBeenCalled();
    expect(queue.enqueuePending).not.toHaveBeenCalled();
  });

  it('DB/queue gagal → tidak melempar', async () => {
    const { service } = makeService({ repository: { transaction: jest.fn().mockRejectedValue(new Error('db down')) } });
    await expect(service.notifyAdmins(input)).resolves.toBeUndefined();
  });
});

describe('NotificationService.notifySubscriptionActive', () => {
  const billing = {
    id: 'b1',
    userId: 'u1',
    subscription: { name: 'Gold' },
    expiryDate: new Date('2026-12-31T00:00:00.000Z'),
  };

  it('membuat row ACTIVE owner + detail paket/tanggal lalu enqueue', async () => {
    const { service, repository, queue } = makeService();
    await service.notifySubscriptionActive(billing as never);

    const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      userId: 'u1',
      type: NotificationType.SUBSCRIPTION_ACTIVE,
      entityType: NotificationEntityType.SUBSCRIPTION,
      entityId: 'b1',
      title: 'Gold',
      body: 'Package: Gold\nActive until: 2026-12-31',
      linkPath: '/my-billings',
    });
    expect(queue.enqueuePending).toHaveBeenCalledWith(NotificationEntityType.SUBSCRIPTION, 'b1');
  });

  it('duplikat (createMany 0) → tidak enqueue', async () => {
    const { service, repository, queue } = makeService({ repository: { createMany: jest.fn().mockResolvedValue(0) } });
    await service.notifySubscriptionActive(billing as never);
    expect(queue.enqueuePending).not.toHaveBeenCalled();
  });

  it('DB gagal → tidak melempar', async () => {
    const { service } = makeService({ repository: { createMany: jest.fn().mockRejectedValue(new Error('db down')) } });
    await expect(service.notifySubscriptionActive(billing as never)).resolves.toBeUndefined();
  });
});

describe('NotificationService.notifySubscriptionCanceled', () => {
  const billing = {
    id: 'b1',
    userId: 'u1',
    subscription: { name: 'Gold' },
    canceledAt: new Date('2026-10-24T00:00:00.000Z'),
  };

  it('membuat row CANCELED owner + entityId billing.id lalu enqueue', async () => {
    const { service, repository, queue } = makeService();
    await service.notifySubscriptionCanceled(billing as never);

    const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      userId: 'u1',
      type: NotificationType.SUBSCRIPTION_CANCELED,
      entityType: NotificationEntityType.SUBSCRIPTION,
      entityId: 'b1',
      title: 'Gold',
      body: 'Package: Gold\nCanceled on: 2026-10-24',
      linkPath: '/my-billings',
    });
    expect(queue.enqueuePending).toHaveBeenCalledWith(NotificationEntityType.SUBSCRIPTION, 'b1');
  });

  it('canceledAt null → pakai hari ini (UTC)', async () => {
    jest.useFakeTimers().setSystemTime(now);
    try {
      const { service, repository } = makeService();
      await service.notifySubscriptionCanceled({ ...billing, canceledAt: null } as never);
      const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
      expect(rows[0].body).toBe('Package: Gold\nCanceled on: 2026-10-19');
    } finally {
      jest.useRealTimers();
    }
  });

  it('duplikat (createMany 0) → tidak enqueue', async () => {
    const { service, queue } = makeService({ repository: { createMany: jest.fn().mockResolvedValue(0) } });
    await service.notifySubscriptionCanceled(billing as never);
    expect(queue.enqueuePending).not.toHaveBeenCalled();
  });

  it('DB gagal → tidak melempar', async () => {
    const { service } = makeService({ repository: { createMany: jest.fn().mockRejectedValue(new Error('db down')) } });
    await expect(service.notifySubscriptionCanceled(billing as never)).resolves.toBeUndefined();
  });
});

describe('NotificationService.enqueueSubscriptionLifecycle', () => {
  const expiring = { id: 'b1', userId: 'u1', name: 'Gold', expiryDate: new Date('2026-10-22T00:00:00.000Z') };
  const expired = { id: 'b2', userId: 'u2', name: 'Silver', expiryDate: new Date('2026-10-01T00:00:00.000Z') };

  it('EXPIRING + EXPIRED dari dua window, Days left dihitung, enqueue per billing', async () => {
    const { service, repository, queue } = makeService({
      repository: { createMany: jest.fn().mockResolvedValue(2) },
    });

    await expect(
      service.enqueueSubscriptionLifecycle({ expiring: [expiring], expired: [expired] }, now),
    ).resolves.toBe(2);

    const [, rows] = repository.createMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      userId: 'u1',
      type: NotificationType.SUBSCRIPTION_EXPIRING,
      entityId: 'b1',
      body: 'Package: Gold\nExpires on: 2026-10-22\nDays left: 3',
    });
    expect(rows[1]).toMatchObject({
      userId: 'u2',
      type: NotificationType.SUBSCRIPTION_EXPIRED,
      entityId: 'b2',
      body: 'Package: Silver\nExpires on: 2026-10-01',
    });
    expect(queue.enqueuePending).toHaveBeenCalledTimes(2);
    expect(queue.enqueuePending).toHaveBeenCalledWith(NotificationEntityType.SUBSCRIPTION, 'b1');
  });

  it('tanpa baris → 0, tidak create/enqueue', async () => {
    const { service, repository, queue } = makeService();
    await expect(service.enqueueSubscriptionLifecycle({ expiring: [], expired: [] }, now)).resolves.toBe(0);
    expect(repository.createMany).not.toHaveBeenCalled();
    expect(queue.enqueuePending).not.toHaveBeenCalled();
  });

  it('expiryDate null dibuang', async () => {
    const { service, repository, queue } = makeService({
      repository: { createMany: jest.fn().mockResolvedValue(1) },
    });
    await expect(
      service.enqueueSubscriptionLifecycle({ expiring: [{ ...expiring, expiryDate: null }], expired: [] }, now),
    ).resolves.toBe(0);
    expect(repository.createMany).not.toHaveBeenCalled();
    expect(queue.enqueuePending).not.toHaveBeenCalled();
  });

  it('insert gagal → 0 tanpa melempar', async () => {
    const { service } = makeService({
      repository: { createMany: jest.fn().mockRejectedValue(new Error('db down')) },
    });
    await expect(
      service.enqueueSubscriptionLifecycle({ expiring: [expiring], expired: [] }, now),
    ).resolves.toBe(0);
  });
});

describe('NotificationService preferences', () => {
  it('baris absen → emailEnabled true untuk semua tipe', async () => {
    const { service } = makeService();
    await expect(service.getPreferences('u1')).resolves.toEqual(
      Object.values(NotificationType).map((type) => ({
        type,
        channel: NotificationChannel.EMAIL,
        emailEnabled: true,
      })),
    );
  });

  it('baris opt-out dipakai', async () => {
    const { service } = makeService({
      repository: {
        findPreferences: jest.fn().mockResolvedValue([
          { type: NotificationType.CONTENT_PUBLISHED, channel: NotificationChannel.EMAIL, emailEnabled: false },
        ]),
      },
    });
    const rows = await service.getPreferences('u1');
    expect(rows[0].emailEnabled).toBe(false);
  });

  it('updatePreference → upsert (userId, type, EMAIL)', async () => {
    const { service, repository } = makeService();
    await service.updatePreference('u1', NotificationType.CONTENT_PUBLISHED, false);
    expect(repository.upsertPreference).toHaveBeenCalledWith('u1', NotificationType.CONTENT_PUBLISHED, false);
  });

  it('markAllRead mengembalikan jumlah update', async () => {
    const { service } = makeService();
    await expect(service.markAllRead('u1')).resolves.toEqual({ updated: 2 });
  });
});

describe('NotificationRepository.findAdminRecipientIds', () => {
  it('hanya admin ACTIVE + preferensi EMAIL tipe tersebut tidak false', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'admin1' }]);
    const repository = new NotificationRepository({ user: { findMany } } as never);

    await expect(
      repository.findAdminRecipientIds(undefined, NotificationType.CONTENT_SUBMITTED),
    ).resolves.toEqual(['admin1']);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: UserStatus.ACTIVE,
        role: { code: 'admin' },
        notificationPreferences: {
          none: {
            type: NotificationType.CONTENT_SUBMITTED,
            channel: NotificationChannel.EMAIL,
            emailEnabled: false,
          },
        },
      },
      select: { id: true },
    });
  });
});

describe('NotificationRepository.createMany', () => {
  it('skipDuplicates true (idempotensi enqueue)', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new NotificationRepository({ notification: { createMany } } as never);
    await repository.createMany(undefined, [{ userId: 'u1' } as never]);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true, data: [{ userId: 'u1' }] }),
    );
  });
});

describe('NotificationService.errorTag (observability)', () => {
  it('PrismaClientUnknownRequestError → pesan asli ikut dilog, tanpa nama/body row', async () => {
    const error = Object.assign(
      new Error('Invalid `notification.createMany()` invocation\n\ninvalid input value for enum "NotificationType"'),
      { name: 'PrismaClientUnknownRequestError' },
    );
    const { service } = makeService({ repository: { createMany: jest.fn().mockRejectedValue(error) } });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      await service.notifySubscriptionActive({
        id: 'b1',
        userId: 'u1',
        subscription: { name: 'Paket' },
        expiryDate: new Date('2027-01-01T00:00:00.000Z'),
      } as never);
      const message = warn.mock.calls[0][0] as string;
      expect(message).toContain('PrismaClientUnknownRequestError');
      expect(message).toContain('invalid input value for enum');
      expect(message).not.toContain('Paket');
    } finally {
      warn.mockRestore();
    }
  });
});
