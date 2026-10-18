import { ConflictException } from '@nestjs/common';
import type { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { ArchiveService } from './archive.service';

const archive = {
  id: 'a1',
  name: 'Judul',
  slug: 'judul-3',
  description: null,
  thumbnail: null,
  type: 'PUBLIC',
  status: 'DRAFT',
  source: 'REGISTERED',
  publishedAt: null,
  approvedAt: null,
  externalLinks: [],
  documentIds: [],
  date: null,
  author: null,
  organisation: null,
  countryId: null,
  stateId: null,
  materialType: null,
  creator: null,
  categories: [],
  authors: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeService(existsBySlug: jest.Mock, create: jest.Mock) {
  const service = new ArchiveService(
    { existsBySlug, create } as never,
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
    {
      resolve: jest.fn().mockResolvedValue({ kind: 'all', canViewPrivate: true, isMember: true }),
    } as unknown as AccessScopeService,
    { publishAfterCommit: jest.fn(), enqueueContentPublished: jest.fn(), enqueuePending: jest.fn() } as never,
  );
  return service;
}

describe('ArchiveService.create slug', () => {
  it('slug bentrok → suffix -2, -3', async () => {
    const existsBySlug = jest.fn(async (slug: string) => slug !== 'judul-3');
    const create = jest.fn().mockResolvedValue(archive);
    const service = makeService(existsBySlug, create);

    await service.create({ name: 'Judul' } as never, 'admin');

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'judul-3' }), undefined);
  });

  it('kalah race P2002 → retry slug (bukan 409)', async () => {
    const existsBySlug = jest.fn(async (slug: string) => slug === 'judul');
    const create = jest
      .fn()
      .mockRejectedValueOnce(new ConflictException('Slug already exists'))
      .mockResolvedValue(archive);
    const service = makeService(existsBySlug, create);

    await service.create({ name: 'Judul' } as never, 'admin');

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ slug: 'judul-2' }), undefined);
  });
});
