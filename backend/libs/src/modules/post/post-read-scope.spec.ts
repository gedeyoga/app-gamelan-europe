import { ForbiddenException } from '@nestjs/common';
import type { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { PostService } from './post.service';

// Non-writer scope: baca hanya konten terbit; PRIVATE hanya bila `isMember` (tanpa write permission).
const memberScope = { kind: 'published', canViewPrivate: false, isMember: true };
const nonMemberScope = { kind: 'published', canViewPrivate: false, isMember: false };

function makeService(scope: unknown) {
  const post = {
    id: 'p1',
    name: 'Private story',
    slug: 'private-story',
    content: '',
    thumbnail: null,
    status: 'PUBLISHED',
    visibility: 'PRIVATE',
    publishedAt: new Date(Date.now() - 1000),
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
  const postRepository = { findById: jest.fn().mockResolvedValue(post) };
  const imageRepository = { findByIds: jest.fn().mockResolvedValue([]) };
  const service = new PostService(
    postRepository as never,
    imageRepository as never,
    { toImageResponse: (image: unknown) => image } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { resolve: jest.fn().mockResolvedValue(scope) } as unknown as AccessScopeService,
  );
  return { service };
}

describe('PostService read scope: PRIVATE visibility', () => {
  it('active member tanpa write permission → boleh baca PRIVATE', async () => {
    const { service } = makeService(memberScope);
    await expect(service.findOne('p1', 'member')).resolves.toMatchObject({ id: 'p1', visibility: 'PRIVATE' });
  });

  it('non-member tanpa write permission → 403 PRIVATE', async () => {
    const { service } = makeService(nonMemberScope);
    await expect(service.findOne('p1', 'user')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
