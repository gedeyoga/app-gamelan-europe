import { NotificationStatus } from '@prisma/client';
import { NOTIFICATION_JOB_SEND, NotificationQueue } from './notification.queue';
import { NotificationRepository } from './notification.repository';

function makeQueue(overrides: { queue?: Record<string, unknown>; repository?: Record<string, unknown> } = {}) {
  const queue = {
    addBulk: jest.fn().mockResolvedValue([]),
    getJob: jest.fn().mockResolvedValue(undefined),
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides.queue,
  };
  const connection = { quit: jest.fn().mockResolvedValue(undefined) };
  const repository = {
    findPendingByEntity: jest.fn().mockResolvedValue([]),
    ...overrides.repository,
  };
  const producer = new NotificationQueue(queue as never, connection as never, repository as never);
  return { producer, queue, repository };
}

describe('NotificationQueue.enqueuePending', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-19T12:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('jobId = row.id, delay dihitung, retry/backoff/retention sesuai spec', async () => {
    const scheduledAt = new Date('2026-10-19T12:05:00.000Z');
    const { producer, queue } = makeQueue({
      repository: { findPendingByEntity: jest.fn().mockResolvedValue([{ id: 'n1', scheduledAt }]) },
    });

    await producer.enqueuePending('POST' as never, 'p1');

    expect(queue.addBulk).toHaveBeenCalledWith([
      {
        name: NOTIFICATION_JOB_SEND,
        data: { notificationId: 'n1' },
        opts: {
          jobId: 'n1',
          delay: 300_000,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      },
    ]);
  });

  it('scheduledAt lampau → delay 0', async () => {
    const { producer, queue } = makeQueue({
      repository: {
        findPendingByEntity: jest.fn().mockResolvedValue([{ id: 'n1', scheduledAt: new Date('2020-01-01T00:00:00Z') }]),
      },
    });
    await producer.enqueuePending('POST' as never, 'p1');
    const [[job]] = queue.addBulk.mock.calls[0] as [[{ opts: { delay: number } }]];
    expect(job.opts.delay).toBe(0);
  });

  it('tidak ada row pending → tidak addBulk', async () => {
    const { producer, queue } = makeQueue();
    await producer.enqueuePending('POST' as never, 'p1');
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('duplicate enqueue memakai jobId sama (BullMQ dedupe)', async () => {
    const row = { id: 'n1', scheduledAt: new Date('2026-10-19T12:00:00Z') };
    const { producer, queue } = makeQueue({
      repository: { findPendingByEntity: jest.fn().mockResolvedValue([row]) },
    });
    await producer.enqueuePending('POST' as never, 'p1');
    await producer.enqueuePending('POST' as never, 'p1');
    const ids = (queue.addBulk.mock.calls as [[{ opts: { jobId: string } }]][]).map(([jobs]) => jobs[0].opts.jobId);
    expect(ids).toEqual(['n1', 'n1']);
  });
});

describe('NotificationQueue.enqueueDue (recovery)', () => {
  it('job terminal dihapus dulu lalu di-enqueue ulang', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const getState = jest.fn().mockResolvedValue('completed');
    const getJob = jest.fn().mockResolvedValue({ getState, remove });
    const { producer, queue } = makeQueue({ queue: { getJob } });

    await producer.enqueueDue([{ id: 'n1', scheduledAt: new Date() }]);

    expect(getJob).toHaveBeenCalledWith('n1');
    expect(remove).toHaveBeenCalled();
    expect(queue.addBulk).toHaveBeenCalled();
  });

  it('job aktif tidak dihapus', async () => {
    const remove = jest.fn();
    const getJob = jest.fn().mockResolvedValue({ getState: jest.fn().mockResolvedValue('waiting'), remove });
    const { producer } = makeQueue({ queue: { getJob } });
    await producer.enqueueDue([{ id: 'n1', scheduledAt: new Date() }]);
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('NotificationQueue.enqueueRecovery', () => {
  it('scheduler repeatable tiap 5 menit', async () => {
    const { producer, queue } = makeQueue();
    await producer.enqueueRecovery();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'notifications-recovery',
      { every: 300_000 },
      expect.objectContaining({ name: 'recover' }),
    );
  });

  it('Redis gagal saat boot → tidak melempar', async () => {
    const { producer } = makeQueue({
      queue: { upsertJobScheduler: jest.fn().mockRejectedValue(new Error('redis down')) },
    });
    await expect(producer.enqueueRecovery()).resolves.toBeUndefined();
  });
});

describe('NotificationRepository.findDue', () => {
  it('hanya PENDING dengan scheduledAt <= now', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new NotificationRepository({ notification: { findMany } } as never);
    await repository.findDue(100);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: NotificationStatus.PENDING,
          scheduledAt: { lte: expect.any(Date) },
        },
        take: 100,
      }),
    );
  });
});
