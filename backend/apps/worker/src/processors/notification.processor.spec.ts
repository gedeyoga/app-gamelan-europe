import {
  NotificationEntityType,
  NotificationStatus,
  NotificationType,
  UserStatus,
} from '@prisma/client';
import { NotificationProcessor, safeErrorName } from './notification.processor';
import { NOTIFICATION_JOB_RECOVER, NOTIFICATION_JOB_SEND } from '@app/libs/modules/notification/notification.queue';

function makeProcessor(overrides: {
  repository?: Record<string, unknown>;
  smtp?: Record<string, unknown>;
} = {}) {
  const repository = {
    findByIdForSend: jest.fn(),
    findDue: jest.fn().mockResolvedValue([]),
    markSent: jest.fn().mockResolvedValue(undefined),
    markSkipped: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    ...overrides.repository,
  };
  const smtp = {
    isConfigured: jest.fn().mockReturnValue(true),
    send: jest.fn().mockResolvedValue(undefined),
    ...overrides.smtp,
  };
  const queue = { enqueueDue: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('https://app.example.com') };
  const processor = new NotificationProcessor(
    repository as never,
    queue as never,
    smtp as never,
    config as never,
  );
  return { processor, repository, smtp, queue, config };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    type: NotificationType.CONTENT_PUBLISHED,
    entityType: NotificationEntityType.POST,
    title: 'Judul',
    body: 'Isi berita',
    imageUrl: 'https://cdn.example.com/a.jpg',
    linkPath: '/stories/judul',
    status: NotificationStatus.PENDING,
    user: {
      email: 'member@example.com',
      status: UserStatus.ACTIVE,
      notificationPreferences: [],
    },
    ...overrides,
  };
}

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    name: NOTIFICATION_JOB_SEND,
    data: { notificationId: 'n1' },
    opts: { attempts: 3 },
    attemptsMade: 1,
    ...overrides,
  };
}

describe('NotificationProcessor.send', () => {
  it('sukses → SENT + sentAt + email dengan URL APP_WEB_URL', async () => {
    const { processor, repository, smtp } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(makeRow()) },
    });

    await processor.handle(makeJob() as never);

    expect(smtp.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'member@example.com',
        subject: 'Story baru: Judul',
        text: expect.stringContaining('https://app.example.com/stories/judul'),
        html: expect.stringContaining('src="https://cdn.example.com/a.jpg"'),
      }),
    );
    expect(repository.markSent).toHaveBeenCalledWith('n1', expect.any(Date));
  });

  it('row non-PENDING → no-op (SMTP tidak dipanggil)', async () => {
    const { processor, repository, smtp } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(makeRow({ status: NotificationStatus.SENT })) },
    });

    await processor.handle(makeJob() as never);

    expect(smtp.send).not.toHaveBeenCalled();
    expect(repository.markSent).not.toHaveBeenCalled();
  });

  it('row hilang → no-op', async () => {
    const { processor, smtp } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(null) },
    });
    await processor.handle(makeJob() as never);
    expect(smtp.send).not.toHaveBeenCalled();
  });

  it('user nonaktif → SKIPPED tanpa kirim', async () => {
    const row = makeRow({ user: { ...makeRow().user, status: UserStatus.INACTIVE } });
    const { processor, repository, smtp } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(row) },
    });

    await processor.handle(makeJob() as never);

    expect(repository.markSkipped).toHaveBeenCalledWith('n1');
    expect(smtp.send).not.toHaveBeenCalled();
  });

  it('preferensi emailEnabled=false → SKIPPED', async () => {
    const row = makeRow({
      user: {
        ...makeRow().user,
        notificationPreferences: [{ type: NotificationType.CONTENT_PUBLISHED, emailEnabled: false }],
      },
    });
    const { processor, repository, smtp } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(row) },
    });

    await processor.handle(makeJob() as never);

    expect(repository.markSkipped).toHaveBeenCalledWith('n1');
    expect(smtp.send).not.toHaveBeenCalled();
  });

  it('preferensi tipe lain tidak memblokir → tetap dikirim', async () => {
    const row = makeRow({
      user: {
        ...makeRow().user,
        notificationPreferences: [{ type: NotificationType.CONTENT_SUBMITTED, emailEnabled: false }],
      },
    });
    const { processor, smtp } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(row) },
    });
    await processor.handle(makeJob() as never);
    expect(smtp.send).toHaveBeenCalledTimes(1);
  });

  it('tipe submission → subject memuat tipe konten + judul', async () => {
    const row = makeRow({ type: NotificationType.CONTENT_SUBMITTED, entityType: NotificationEntityType.EVENT });
    const { processor, smtp } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(row) },
    });
    await processor.handle(makeJob() as never);
    expect(smtp.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Pengajuan Event baru: Judul' }),
    );
  });

  it('baris preferensi absen → tetap dikirim', async () => {
    const { processor, smtp } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(makeRow()) },
    });
    await processor.handle(makeJob() as never);
    expect(smtp.send).toHaveBeenCalledTimes(1);
  });

  it('SMTP belum dikonfigurasi → tidak throw, row tetap PENDING', async () => {
    const { processor, repository, smtp } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(makeRow()) },
      smtp: { isConfigured: jest.fn().mockReturnValue(false) },
    });

    await expect(processor.handle(makeJob() as never)).resolves.toBeUndefined();
    expect(smtp.send).not.toHaveBeenCalled();
    expect(repository.markSent).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('SMTP gagal → throw supaya BullMQ retry', async () => {
    const { processor } = makeProcessor({
      repository: { findByIdForSend: jest.fn().mockResolvedValue(makeRow()) },
      smtp: { send: jest.fn().mockRejectedValue(new Error('boom')) },
    });
    await expect(processor.handle(makeJob() as never)).rejects.toThrow('boom');
  });
});

describe('NotificationProcessor.recover', () => {
  it('scan due lalu re-enqueue', async () => {
    const rows = [{ id: 'n1', scheduledAt: new Date() }];
    const { processor, repository, queue } = makeProcessor({
      repository: { findDue: jest.fn().mockResolvedValue(rows) },
    });

    await processor.handle(makeJob({ name: NOTIFICATION_JOB_RECOVER, data: {} }) as never);

    expect(repository.findDue).toHaveBeenCalledWith(100);
    expect(queue.enqueueDue).toHaveBeenCalledWith(rows);
  });
});

describe('NotificationProcessor.onFailed', () => {
  it('attempt final → FAILED + lastError aman (tanpa PII)', async () => {
    const { processor, repository } = makeProcessor();
    await processor.onFailed(
      makeJob({ attemptsMade: 3 }) as never,
      new Error('SMTP rejected member@example.com with password secret'),
    );
    expect(repository.markFailed).toHaveBeenCalledWith('n1', 'Error');
  });

  it('attempt non-final → tidak menulis lastError/FAILED', async () => {
    const { processor, repository } = makeProcessor();
    await processor.onFailed(makeJob({ attemptsMade: 2 }) as never, new Error('boom'));
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('safeErrorName memakai name + code, ≤200 char', () => {
    expect(safeErrorName(Object.assign(new Error('x'), { name: 'EAUTH', code: 'ETIMEDOUT' }))).toBe('EAUTH:ETIMEDOUT');
    expect(safeErrorName(undefined)).toBe('Error');
    expect(safeErrorName({ name: 'X'.repeat(500) }).length).toBe(200);
  });
});
