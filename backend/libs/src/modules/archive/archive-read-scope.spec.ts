import type { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { ArchiveService } from './archive.service';

const memberArchive = {
  id: 'a1',
  name: 'Member archive',
  description: null,
  thumbnail: null,
  type: 'MEMBER',
  status: 'PUBLISHED',
  publishedAt: new Date(Date.now() - 1000),
  approvedAt: null,
  externalLinks: ['https://example.org/paper'],
  documentIds: [],
  creator: { id: 'u1', fullName: 'Budi', networkId: null },
  categories: [],
  authors: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeService(scope: unknown) {
  const archiveRepository = { findById: jest.fn().mockResolvedValue(memberArchive) };
  const documentRepository = { findByIds: jest.fn().mockResolvedValue([]) };
  const service = new ArchiveService(
    archiveRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    documentRepository as never,
    { toDocumentResponse: (document: unknown) => document } as never,
    {} as never,
    { resolve: jest.fn().mockResolvedValue(scope) } as unknown as AccessScopeService,
  );
  return { service };
}

describe('ArchiveService read scope: type=MEMBER', () => {
  it('active member tanpa write permission → externalLinks tidak diredaksi', async () => {
    const { service } = makeService({ kind: 'published', canViewPrivate: false, isMember: true });
    const result = await service.findOne('a1', 'member');
    expect(result.externalLinks).toEqual(['https://example.org/paper']);
    expect(result.documents).toEqual([]);
  });

  it('non-member → externalLinks & documents diredaksi (null)', async () => {
    const { service } = makeService({ kind: 'published', canViewPrivate: false, isMember: false });
    const result = await service.findOne('a1', 'user');
    expect(result.externalLinks).toBeNull();
    expect(result.documents).toBeNull();
  });
});
