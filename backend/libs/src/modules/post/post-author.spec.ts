import type { PrismaService } from '@app/libs/core/database/prisma.service';
import { EventService } from '../event/event.service';
import { PostRepository } from './post.repository';
import { PostService } from './post.service';

const UNKNOWN_USER = '00000000-0000-4000-8000-000000000000';
const allScope = () => ({
  resolve: jest.fn().mockResolvedValue({ kind: 'all', userId: 'admin', canViewPrivate: true }),
});

describe('PostRepository author replace', () => {
  it('update authorIds → deleteMany lalu createMany (replace)', async () => {
    const row = {
      id: 'p1',
      name: 'N',
      slug: 'n',
      status: 'DRAFT',
      publishedAt: null,
      approvedAt: null,
      content: '',
      thumbnail: null,
      galleryImageIds: [],
      flyerItems: [],
      visibility: 'PUBLIC',
      createdBy: 'u1',
      creator: null,
      categories: [],
      authors: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tx = {
      post: { update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue(row) },
      postAuthor: { deleteMany: jest.fn(), createMany: jest.fn() },
      postCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
      image: { updateMany: jest.fn() },
    };
    const prisma = {
      post: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new PostRepository(prisma as unknown as PrismaService);

    await repo.update('p1', { authorIds: ['u1', 'u2'] });

    expect(tx.postAuthor.deleteMany).toHaveBeenCalledWith({ where: { postId: 'p1' } });
    expect(tx.postAuthor.createMany).toHaveBeenCalledWith({
      data: [
        { postId: 'p1', authorId: 'u1' },
        { postId: 'p1', authorId: 'u2' },
      ],
      skipDuplicates: true,
    });
    expect(tx.postAuthor.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.postAuthor.createMany.mock.invocationCallOrder[0],
    );
  });
});

describe('PostService author validation', () => {
  const dto = { name: 'Story', authorIds: [UNKNOWN_USER] };

  function makeService(findByIds: jest.Mock, postRepository: Record<string, unknown> = { create: jest.fn() }): PostService {
    return new PostService(
      postRepository as unknown as PostRepository,
      {} as never,
      {} as never,
      { findByIds } as never,
      {} as never,
      allScope() as never,
    );
  }

  it('create: non-existent user id → 422 field-scoped', async () => {
    const findByIds = jest.fn().mockResolvedValue([]);
    const service = makeService(findByIds);

    await expect(service.create(dto as never, 'admin')).rejects.toMatchObject({
      response: {
        message: 'Validation failed',
        errors: [{ field: 'authorIds.0', message: 'authorId must reference an existing user' }],
      },
    });
    expect(findByIds).toHaveBeenCalledWith(dto.authorIds);
  });

  it('update: non-existent user id → 422 field-scoped', async () => {
    const findByIds = jest.fn().mockResolvedValue([]);
    const existing = {
      id: 'p1',
      visibility: 'PUBLIC',
      creator: null,
      createdBy: 'u1',
      status: 'DRAFT',
      publishedAt: null,
      approvedAt: null,
      galleryImageIds: [],
      flyerItems: [],
    };
    const service = makeService(findByIds, { findById: jest.fn().mockResolvedValue(existing) });

    await expect(service.update('p1', { authorIds: dto.authorIds } as never, 'admin')).rejects.toMatchObject({
      response: {
        message: 'Validation failed',
        errors: [{ field: 'authorIds.0', message: 'authorId must reference an existing user' }],
      },
    });
    expect(findByIds).toHaveBeenCalledWith(dto.authorIds);
  });
});

describe('EventService author validation', () => {
  it('create: non-existent user id → 422 field-scoped', async () => {
    const findByIds = jest.fn().mockResolvedValue([]);
    const service = new EventService(
      {} as never,
      {} as never,
      { findByIds } as never,
      allScope() as never,
    );

    await expect(service.create({ name: 'Event', authorIds: [UNKNOWN_USER] } as never, 'admin')).rejects.toMatchObject({
      response: {
        message: 'Validation failed',
        errors: [{ field: 'authorIds.0', message: 'authorId must reference an existing user' }],
      },
    });
    expect(findByIds).toHaveBeenCalledWith([UNKNOWN_USER]);
  });
});
