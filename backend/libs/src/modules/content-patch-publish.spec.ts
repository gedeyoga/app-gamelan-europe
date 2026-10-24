import { ForbiddenException } from '@nestjs/common';
import type { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { PostService } from './post/post.service';
import { EventService } from './event/event.service';
import { ArchiveService } from './archive/archive.service';

// Bukti gate publish via `PATCH /<domain>/:id`:
// (a) hanya `*:update` + `*:reject` → 403, (b) `*:publish` → sukses,
// (c) `publishedAt: null` tidak mengubah status maupun tanggal.
const row = (id: string) => ({
  id,
  name: 'Judul',
  slug: 'judul',
  content: '<p>Isi</p>',
  description: 'Ringkas',
  thumbnail: null,
  status: 'DRAFT',
  visibility: 'PUBLIC',
  publishedAt: null,
  approvedAt: null,
  createdBy: 'author',
  creator: null,
  categories: [],
  authors: [],
  documents: [],
  galleryImageIds: [],
  flyerItems: [],
  documentIds: [],
  externalLinks: [],
  type: 'PHOTO',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const allScope = {
  resolve: jest.fn().mockResolvedValue({ kind: 'all', canViewPrivate: true, isMember: true }),
} as unknown as AccessScopeService;

function makePost() {
  const postRepository = { findById: jest.fn().mockResolvedValue(row('p1')), update: jest.fn().mockResolvedValue(row('p1')) };
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
    allScope,
    { publishAfterCommit: jest.fn(), enqueuePending: jest.fn() } as never,
  );
  return { service, update: postRepository.update };
}

function makeEvent() {
  const eventRepository = {
    findById: jest.fn().mockResolvedValue(row('e1')),
    update: jest.fn().mockResolvedValue(row('e1')),
  };
  const service = new EventService(
    eventRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    allScope,
    { publishAfterCommit: jest.fn(), enqueuePending: jest.fn() } as never,
  );
  return { service, update: eventRepository.update };
}

function makeArchive() {
  const archiveRepository = {
    findById: jest.fn().mockResolvedValue(row('a1')),
    update: jest.fn().mockResolvedValue(row('a1')),
  };
  const service = new ArchiveService(
    archiveRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { findByIds: jest.fn().mockResolvedValue([]) } as never,
    {} as never,
    {} as never,
    allScope,
    { publishAfterCommit: jest.fn(), enqueuePending: jest.fn() } as never,
  );
  return { service, update: archiveRepository.update };
}

const modules = [
  { name: 'post', resource: 'story', make: makePost },
  { name: 'event', resource: 'event', make: makeEvent },
  { name: 'archive', resource: 'archive', make: makeArchive },
] as const;

type Ctx = {
  service: { update(id: string, dto: object, userId: string, permissions: string[]): Promise<unknown> };
  update: jest.Mock;
};

describe.each(modules)('PATCH /$name/:id publish gate', ({ resource, make }) => {
  const call = (ctx: Ctx, dto: Record<string, unknown>, permissions: string[]) =>
    ctx.service.update('x1', dto, 'user', permissions);

  it('status PUBLISHED hanya dengan update+reject → 403', async () => {
    const ctx = make();
    await expect(call(ctx, { status: 'PUBLISHED' }, [`${resource}:update`, `${resource}:reject`])).rejects.toThrow(
      ForbiddenException,
    );
    expect(ctx.update).not.toHaveBeenCalled();
  });

  it('status PUBLISHED dengan publish → sukses', async () => {
    const ctx = make();
    await expect(call(ctx, { status: 'PUBLISHED' }, [`${resource}:update`, `${resource}:publish`])).resolves.toBeDefined();
    expect(ctx.update).toHaveBeenCalled();
  });

  it('publishedAt null tidak mengubah status maupun tanggal', async () => {
    const ctx = make();
    await call(ctx, { publishedAt: null }, [`${resource}:update`]);
    const data = ctx.update.mock.calls[0][1] as Record<string, unknown>;
    expect(data).not.toHaveProperty('status');
    expect(data).not.toHaveProperty('publishedAt');
  });
});
