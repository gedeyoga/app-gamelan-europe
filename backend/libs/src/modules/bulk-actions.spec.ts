import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArchiveStatus, ContentStatus } from '@prisma/client';
import { ArchiveService } from './archive/archive.service';
import { EventService } from './event/event.service';
import { PostService } from './post/post.service';

const stub = () => ({}) as never;

function postRow(status: ContentStatus, extra: Record<string, unknown> = {}) {
  return {
    id: 'a',
    status,
    visibility: 'PUBLIC',
    name: 'Title',
    content: 'body',
    thumbnail: null,
    slug: 'title',
    publishedAt: null,
    approvedAt: null,
    createdBy: 'u1',
    creator: null,
    galleryImageIds: [],
    flyerItems: [],
    ...extra,
  };
}

function makePostService() {
  const findById = jest.fn();
  const updateStatusIf = jest.fn().mockResolvedValue(true);
  const accessScope = { resolve: jest.fn().mockResolvedValue({ kind: 'all' }) };
  const notificationService = { enqueueContentPublished: jest.fn(), enqueuePending: jest.fn() };
  const service = new PostService(
    {
      findById,
      updateStatusIf,
      transaction: (fn: (tx: unknown) => unknown) => fn({}),
    } as never,
    { findByIds: jest.fn().mockResolvedValue([]) } as never,
    stub(), stub(), stub(), stub(), stub(), stub(), stub(),
    accessScope as never,
    notificationService as never,
  );
  return { service, findById, updateStatusIf, accessScope };
}

function eventRow(status: ContentStatus) {
  return { id: 'a', status, visibility: 'PUBLIC', name: 'Title', content: 'body', thumbnail: null, slug: 'title', publishedAt: null, approvedAt: null, createdBy: 'u1', creator: null };
}

function makeEventService() {
  const findById = jest.fn();
  const updateStatusIf = jest.fn().mockResolvedValue(true);
  const accessScope = { resolve: jest.fn().mockResolvedValue({ kind: 'all' }) };
  const notificationService = { enqueueContentPublished: jest.fn(), enqueuePending: jest.fn() };
  const service = new EventService(
    { findById, updateStatusIf, transaction: (fn: (tx: unknown) => unknown) => fn({}) } as never,
    stub(), stub(), stub(), stub(), stub(), stub(), stub(), stub(), stub(),
    accessScope as never,
    notificationService as never,
  );
  return { service, findById, updateStatusIf };
}

function archiveRow(status: ArchiveStatus) {
  return { id: 'a', status, name: 'Title', description: 'body', thumbnail: null, slug: 'title', type: 'PUBLIC', publishedAt: null, approvedAt: null, documentIds: [], creator: null };
}

function makeArchiveService() {
  const findById = jest.fn();
  const updateStatusIf = jest.fn();
  const accessScope = { resolve: jest.fn().mockResolvedValue({ kind: 'all' }) };
  const service = new ArchiveService(
    { findById, updateStatusIf, transaction: (fn: (tx: unknown) => unknown) => fn({}) } as never,
    stub(), stub(), stub(), stub(), stub(), stub(), stub(),
    { findByIds: jest.fn().mockResolvedValue([]) } as never,
    stub(), stub(),
    accessScope as never,
    { enqueueContentPublished: jest.fn(), enqueuePending: jest.fn() } as never,
  );
  return { service, findById, updateStatusIf };
}

describe('PostService bulkUpdateStatus', () => {
  it('DRAFT diterbitkan langsung lewat approve (approver tak perlu submit)', async () => {
    const { service, findById, updateStatusIf } = makePostService();
    findById.mockResolvedValue(postRow(ContentStatus.DRAFT));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.PUBLISHED, ['story:update', 'story:approve'], 'u1'),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    // Predikat kondisi = status aktual (DRAFT), bukan seluruh array `from`.
    expect(updateStatusIf).toHaveBeenCalledWith(
      'a',
      ContentStatus.DRAFT,
      ContentStatus.PUBLISHED,
      { publishedAt: expect.any(Date), approvedAt: expect.any(Date) },
      {},
    );
  });

  it('DRAFT diterbitkan lewat publish bila hanya story:publish dipegang', async () => {
    const { service, findById, updateStatusIf } = makePostService();
    findById.mockResolvedValue(postRow(ContentStatus.DRAFT));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.PUBLISHED, ['story:update', 'story:publish'], 'u1'),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith(
      'a',
      ContentStatus.DRAFT,
      ContentStatus.PUBLISHED,
      { publishedAt: expect.any(Date), approvedAt: expect.any(Date) },
      {},
    );
  });

  it('story:update saja tidak bisa publish (403)', async () => {
    const { service, findById, updateStatusIf } = makePostService();
    findById.mockResolvedValue(postRow(ContentStatus.DRAFT));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.PUBLISHED, ['story:update'], 'u1'),
    ).rejects.toThrow('Bulk status PUBLISHED requires permission story:approve or story:publish');
    expect(updateStatusIf).not.toHaveBeenCalled();
  });

  it('balapan: updateStatusIf false → 409 Conflict', async () => {
    const { service, findById, updateStatusIf } = makePostService();
    findById.mockResolvedValue(postRow(ContentStatus.DRAFT));
    updateStatusIf.mockResolvedValue(false);

    await expect(service.transition('a', 'approve', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('PUBLISHED dari REQUEST lewat approve + mengisi approvedAt/publishedAt', async () => {
    const { service, findById, updateStatusIf } = makePostService();
    findById.mockResolvedValue(postRow(ContentStatus.REQUEST));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.PUBLISHED, ['story:update', 'story:approve'], 'u1'),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith(
      'a',
      ContentStatus.REQUEST,
      ContentStatus.PUBLISHED,
      { publishedAt: expect.any(Date), approvedAt: expect.any(Date) },
      {},
    );
  });

  it('item yang sudah PUBLISHED dihitung skipped, bukan updated', async () => {
    const { service, findById, updateStatusIf } = makePostService();
    findById.mockResolvedValue(postRow(ContentStatus.PUBLISHED));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.PUBLISHED, ['story:update', 'story:approve', 'story:publish'], 'u1'),
    ).resolves.toEqual({ updated: 0, skipped: 1, failed: 0 });
    expect(updateStatusIf).not.toHaveBeenCalled();
  });

  it('REQUEST memakai aksi submit (role member: story:update + story:submit)', async () => {
    const { service, findById, updateStatusIf } = makePostService();
    findById.mockResolvedValue(postRow(ContentStatus.DRAFT));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.REQUEST, ['story:update', 'story:submit'], 'u1'),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith('a', ContentStatus.DRAFT, ContentStatus.REQUEST, {}, {});
  });

  it('REQUEST tanpa story:submit → 403, tanpa menyentuh transisi', async () => {
    const { service, findById, updateStatusIf } = makePostService();
    findById.mockResolvedValue(postRow(ContentStatus.DRAFT));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.REQUEST, ['story:update', 'story:reject'], 'u1'),
    ).rejects.toThrow('Bulk status REQUEST requires permission story:submit');
    expect(updateStatusIf).not.toHaveBeenCalled();
  });

  it('APPROVED sebagai target → 400 BadRequest', async () => {
    const { service } = makePostService();

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.APPROVED, ['story:approve'], 'u1'),
    ).rejects.toThrow('Bulk status target APPROVED is not supported');
  });

  it('pelanggaran scope dihitung failed, row tidak diubah', async () => {
    const { service, findById, updateStatusIf, accessScope } = makePostService();
    accessScope.resolve.mockResolvedValue({ kind: 'own', userId: 'u2' });
    findById.mockResolvedValue(postRow(ContentStatus.DRAFT));

    await expect(service.bulkUpdateStatus(['a'], ContentStatus.REQUEST, ['story:submit'], 'u2')).resolves.toEqual({
      updated: 0,
      skipped: 0,
      failed: 1,
    });
    expect(updateStatusIf).not.toHaveBeenCalled();
  });

  it('row tidak ditemukan (404) dihitung skipped', async () => {
    const { service, findById } = makePostService();
    findById.mockRejectedValue(new NotFoundException('Post not found'));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.PUBLISHED, ['story:approve'], 'u1'),
    ).resolves.toEqual({ updated: 0, skipped: 1, failed: 0 });
  });
});

describe('EventService bulkUpdateStatus', () => {
  it('DRAFT diterbitkan langsung lewat approve (approver tak perlu submit)', async () => {
    const { service, findById, updateStatusIf } = makeEventService();
    findById.mockResolvedValue(eventRow(ContentStatus.DRAFT));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.PUBLISHED, ['event:update', 'event:approve'], 'u1'),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith(
      'a',
      ContentStatus.DRAFT,
      ContentStatus.PUBLISHED,
      { publishedAt: expect.any(Date), approvedAt: expect.any(Date) },
      {},
    );
  });

  it('balapan: updateStatusIf false → 409 Conflict', async () => {
    const { service, findById, updateStatusIf } = makeEventService();
    findById.mockResolvedValue(eventRow(ContentStatus.DRAFT));
    updateStatusIf.mockResolvedValue(false);

    await expect(service.transition('a', 'approve', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('PUBLISHED dari APPROVED jatuh ke aksi publish (approve hanya dari DRAFT|REQUEST)', async () => {
    const { service, findById, updateStatusIf } = makeEventService();
    findById.mockResolvedValue(eventRow(ContentStatus.APPROVED));

    await expect(
      service.bulkUpdateStatus(['a'], ContentStatus.PUBLISHED, ['event:update', 'event:approve', 'event:publish'], 'u1'),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledTimes(1);
    // Predikat kondisi = status aktual (APPROVED), bukan seluruh array `from`.
    expect(updateStatusIf.mock.calls[0][1]).toBe(ContentStatus.APPROVED);
    expect(updateStatusIf.mock.calls[0][2]).toBe(ContentStatus.PUBLISHED);
  });
});

describe('ArchiveService bulkUpdateStatus', () => {
  it('DRAFT diterbitkan langsung lewat approve (approver tak perlu submit)', async () => {
    const { service, findById, updateStatusIf } = makeArchiveService();
    const row = archiveRow(ArchiveStatus.DRAFT);
    findById.mockResolvedValue(row);
    updateStatusIf.mockResolvedValue({ ...row, status: ArchiveStatus.PUBLISHED });

    await expect(
      service.bulkUpdateStatus(['a'], ArchiveStatus.PUBLISHED, ['archive:update', 'archive:approve'], 'u1'),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith(
      'a',
      ArchiveStatus.DRAFT,
      ArchiveStatus.PUBLISHED,
      { publishedAt: expect.any(Date), approvedAt: expect.any(Date) },
      {},
    );
  });

  it('DRAFT diterbitkan lewat publish bila hanya archive:publish dipegang', async () => {
    const { service, findById, updateStatusIf } = makeArchiveService();
    const row = archiveRow(ArchiveStatus.DRAFT);
    findById.mockResolvedValue(row);
    updateStatusIf.mockResolvedValue({ ...row, status: ArchiveStatus.PUBLISHED });

    await expect(
      service.bulkUpdateStatus(['a'], ArchiveStatus.PUBLISHED, ['archive:update', 'archive:publish'], 'u1'),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith(
      'a',
      ArchiveStatus.DRAFT,
      ArchiveStatus.PUBLISHED,
      { publishedAt: expect.any(Date), approvedAt: expect.any(Date) },
      {},
    );
  });

  it('balapan: updateStatusIf null → 409 Conflict', async () => {
    const { service, findById, updateStatusIf } = makeArchiveService();
    findById.mockResolvedValue(archiveRow(ArchiveStatus.DRAFT));
    updateStatusIf.mockResolvedValue(null);

    await expect(service.transition('a', 'approve', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('REQUEST butuh archive:submit; archive:reject saja tidak cukup', async () => {
    const { service } = makeArchiveService();

    await expect(
      service.bulkUpdateStatus(['a'], ArchiveStatus.REQUEST, ['archive:update', 'archive:reject'], 'u1'),
    ).rejects.toThrow('Bulk status REQUEST requires permission archive:submit');
  });

  it('DRAFT hanya dengan archive:unpublish: kandidat reject tidak dipakai (REQUEST tetap skipped)', async () => {
    const { service, findById, updateStatusIf } = makeArchiveService();
    findById.mockResolvedValue(archiveRow(ArchiveStatus.REQUEST));

    await expect(
      service.bulkUpdateStatus(['a'], ArchiveStatus.DRAFT, ['archive:update', 'archive:unpublish'], 'u1'),
    ).resolves.toEqual({ updated: 0, skipped: 1, failed: 0 });
    expect(updateStatusIf).not.toHaveBeenCalled();
  });

  it('DRAFT dari PUBLISHED lewat unpublish bila archive:unpublish dipegang', async () => {
    const { service, findById, updateStatusIf } = makeArchiveService();
    const row = archiveRow(ArchiveStatus.PUBLISHED);
    findById.mockResolvedValue(row);
    updateStatusIf.mockResolvedValue({ ...row, status: ArchiveStatus.DRAFT });

    await expect(
      service.bulkUpdateStatus(['a'], ArchiveStatus.DRAFT, ['archive:update', 'archive:unpublish'], 'u1'),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith('a', ArchiveStatus.PUBLISHED, ArchiveStatus.DRAFT, {}, {});
  });

  it('APPROVED sebagai target → 400 BadRequest', async () => {
    const { service } = makeArchiveService();

    await expect(
      service.bulkUpdateStatus(['a'], ArchiveStatus.APPROVED, ['archive:approve'], 'u1'),
    ).rejects.toThrow('Bulk status target APPROVED is not supported');
  });

  it('bulkDelete memakai remove per id; row gagal dihitung failed', async () => {
    const { service } = makeArchiveService();
    const remove = jest.fn((id: string) =>
      id === 'b' ? Promise.reject(new NotFoundException('Archive not found')) : Promise.resolve({}),
    );
    service.remove = remove as never;

    await expect(service.bulkDelete(['a', 'b'], 'u1')).resolves.toEqual({ deleted: 1, failed: 1 });
    expect(remove).toHaveBeenCalledWith('a', 'u1');
  });
});
