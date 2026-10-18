import { NotificationEntityType } from '@prisma/client';
import type { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { PostService } from './post.service';

// Outbox ditulis di transaksi yang sama; enqueue BullMQ hanya setelah commit.
const post = {
  id: 'p1',
  name: 'Judul',
  slug: 'judul',
  content: '<p>Isi</p>',
  thumbnail: null,
  status: 'REQUEST',
  visibility: 'PUBLIC',
  publishedAt: null,
  approvedAt: null,
  createdBy: 'author',
  creator: null,
  categories: [],
  authors: [],
  galleryImageIds: [],
  flyerItems: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeService(order: string[], existingStatus = 'REQUEST') {
  const tx = { id: 'tx' };
  const postRepository = {
    findById: jest
      .fn()
      .mockResolvedValueOnce({ ...post, status: existingStatus })
      .mockResolvedValue({ ...post, status: 'PUBLISHED' }),
    transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) => {
      const result = await fn(tx);
      order.push('commit');
      return result;
    }),
    updateStatusIf: jest.fn().mockImplementation(async () => {
      order.push('update');
      return true;
    }),
  };
  const notificationService = {
    enqueueContentPublished: jest.fn(async (client: unknown) => {
      order.push('enqueue-tx');
      expect(client).toBe(tx);
      return 1;
    }),
    enqueuePending: jest.fn(async () => {
      order.push('enqueue-pending');
    }),
    publishAfterCommit: jest.fn(),
  };
  const service = new PostService(
    postRepository as never,
    { findByIds: jest.fn().mockResolvedValue([]) } as never,
    { toImageResponse: (image: unknown) => image } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      resolve: jest.fn().mockResolvedValue({ kind: 'all', canViewPrivate: true, isMember: true }),
    } as unknown as AccessScopeService,
    notificationService as never,
  );
  return { service, postRepository, notificationService, tx };
}

describe('PostService.transition notification wiring', () => {
  it('approve: row dibuat di transaksi, enqueue setelah commit', async () => {
    const order: string[] = [];
    const { service, notificationService, tx } = makeService(order);
    await service.transition('p1', 'approve', 'admin');

    expect(order).toEqual(['update', 'enqueue-tx', 'commit', 'enqueue-pending']);
    expect(notificationService.enqueueContentPublished).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ entityType: NotificationEntityType.POST, entityId: 'p1' }),
    );
    expect(notificationService.enqueuePending).toHaveBeenCalledWith(NotificationEntityType.POST, 'p1');
  });

  it('submit: tidak menulis outbox dan tidak enqueue', async () => {
    const order: string[] = [];
    const { service, notificationService } = makeService(order, 'DRAFT');
    await service.transition('p1', 'submit', 'author');

    expect(notificationService.enqueueContentPublished).not.toHaveBeenCalled();
    expect(notificationService.enqueuePending).not.toHaveBeenCalled();
  });
});
