import { NotFoundException } from '@nestjs/common';
import { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { ArchiveService } from './archive/archive.service';
import { EventService } from './event/event.service';
import { PostService } from './post/post.service';

const scope = { kind: 'all', canViewPrivate: true, isMember: true };

const post = {
  id: 'p1',
  name: 'Story',
  slug: 'story',
  content: '',
  thumbnail: null,
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  publishedAt: new Date(Date.now() - 1000),
  approvedAt: null,
  createdBy: 'u1',
  creator: null,
  categories: [],
  authors: [],
  galleryImageIds: [],
  flyerItems: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const event = {
  id: 'e1',
  name: 'Event',
  slug: 'event',
  content: '',
  thumbnail: null,
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  publishedAt: new Date(Date.now() - 1000),
  approvedAt: null,
  createdBy: 'u1',
  creator: null,
  createdByNetworkId: null,
  dates: [],
  eventTypes: [],
  authors: [],
  location: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const archive = {
  id: 'a1',
  name: 'Archive',
  slug: 'archive',
  description: null,
  thumbnail: null,
  type: 'PUBLIC',
  status: 'PUBLISHED',
  source: 'REGISTERED',
  publishedAt: new Date(Date.now() - 1000),
  approvedAt: null,
  externalLinks: [],
  documentIds: [],
  creator: null,
  categories: [],
  authors: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePostService(findBySlug: jest.Mock, resolve = jest.fn().mockResolvedValue(scope)) {
  return {
    service: new PostService(
      { findBySlug } as never,
      { findByIds: jest.fn().mockResolvedValue([]) } as never,
      { toImageResponse: (image: unknown) => image } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { resolve } as unknown as AccessScopeService,
      {} as never,
    ),
    resolve,
  };
}

function makeEventService(findBySlug: jest.Mock, resolve = jest.fn().mockResolvedValue(scope)) {
  return {
    service: new EventService(
      { findBySlug } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { resolve } as unknown as AccessScopeService,
      {} as never,
    ),
    resolve,
  };
}

function makeArchiveService(findBySlug: jest.Mock, resolve = jest.fn().mockResolvedValue(scope)) {
  return {
    service: new ArchiveService(
      { findBySlug } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findByIds: jest.fn().mockResolvedValue([]) } as never,
      { toDocumentResponse: (document: unknown) => document } as never,
      {} as never,
      { resolve } as unknown as AccessScopeService,
      {} as never,
    ),
    resolve,
  };
}

// Tautan email `/stories|events|archives/{slug}`: lookup slug + aturan scope harus sama dengan `findOne`.
describe('findOneBySlug parity with findOne', () => {
  it('post', async () => {
    const { service, resolve } = makePostService(jest.fn().mockResolvedValue(post));
    await expect(service.findOneBySlug('story', 'u1')).resolves.toMatchObject({ id: 'p1' });
    expect(resolve).toHaveBeenCalledWith('u1', 'story');
  });

  it('event', async () => {
    const { service, resolve } = makeEventService(jest.fn().mockResolvedValue(event));
    await expect(service.findOneBySlug('event', 'u1')).resolves.toMatchObject({ id: 'e1' });
    expect(resolve).toHaveBeenCalledWith('u1', 'event');
  });

  it('archive', async () => {
    const { service, resolve } = makeArchiveService(jest.fn().mockResolvedValue(archive));
    await expect(service.findOneBySlug('archive', 'u1')).resolves.toMatchObject({ id: 'a1' });
    expect(resolve).toHaveBeenCalledWith('u1', 'archive');
  });

  it('slug tidak ada → 404 dari repository', async () => {
    const missing = jest.fn().mockRejectedValue(new NotFoundException('Post not found'));
    const { service } = makePostService(missing);
    await expect(service.findOneBySlug('ghost', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
