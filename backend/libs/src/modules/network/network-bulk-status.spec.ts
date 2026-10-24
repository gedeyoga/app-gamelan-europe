import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NetworkStatus, NotificationEntityType, NotificationType } from '@prisma/client';
import { NetworkService } from './network.service';

function row(status: NetworkStatus, extra: Record<string, unknown> = {}) {
  return { id: 'a', status, name: 'Gamelan', approvedAt: null, publishedAt: null, ...extra };
}

function makeService() {
  const findById = jest.fn();
  const updateStatusIf = jest.fn();
  const notifyAdmins = jest.fn().mockResolvedValue(undefined);
  const service = new NetworkService(
    { findById, updateStatusIf } as never,
    {} as never,
    {} as never,
    {} as never,
    { notifyAdmins } as never,
  );
  return { service, findById, updateStatusIf, notifyAdmins };
}

describe('NetworkService.bulkUpdateStatus', () => {
  it('PUBLISHED dari REQUEST lewat approve + mengisi approvedAt/publishedAt', async () => {
    const { service, findById, updateStatusIf } = makeService();
    const current = row(NetworkStatus.REQUEST);
    findById.mockResolvedValue(current);
    updateStatusIf.mockResolvedValue(row(NetworkStatus.PUBLISHED));

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.PUBLISHED, ['network:update', 'network:approve']),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith('a', NetworkStatus.REQUEST, NetworkStatus.PUBLISHED, {
      publishedAt: expect.any(Date),
      approvedAt: expect.any(Date),
    });
  });

  it('PUBLISHED dari DRAFT lewat approve (tanpa submit) + mengisi approvedAt/publishedAt', async () => {
    const { service, findById, updateStatusIf } = makeService();
    const current = row(NetworkStatus.DRAFT);
    findById.mockResolvedValue(current);
    updateStatusIf.mockResolvedValue(row(NetworkStatus.PUBLISHED));

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.PUBLISHED, ['network:approve']),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith('a', NetworkStatus.DRAFT, NetworkStatus.PUBLISHED, {
      publishedAt: expect.any(Date),
      approvedAt: expect.any(Date),
    });
  });

  it('REQUEST dari DRAFT lewat submit, tanpa timestamp', async () => {
    const { service, findById, updateStatusIf, notifyAdmins } = makeService();
    const current = row(NetworkStatus.DRAFT);
    findById.mockResolvedValue(current);
    updateStatusIf.mockResolvedValue(row(NetworkStatus.REQUEST));

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.REQUEST, ['network:update']),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith('a', NetworkStatus.DRAFT, NetworkStatus.REQUEST, {});
    // Bulk lewat `transition` → notifikasi admin tetap sekali, tanpa dobel.
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
    expect(notifyAdmins.mock.calls[0][0]).toMatchObject({
      type: NotificationType.CONTENT_SUBMITTED,
      entityType: NotificationEntityType.NETWORK,
      entityId: 'a',
    });
  });

  it('DRAFT dari PUBLISHED lewat unpublish bila network:unpublish dipegang', async () => {
    const { service, findById, updateStatusIf } = makeService();
    const current = row(NetworkStatus.PUBLISHED);
    findById.mockResolvedValue(current);
    updateStatusIf.mockResolvedValue(row(NetworkStatus.DRAFT));

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.DRAFT, ['network:update', 'network:unpublish']),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith('a', NetworkStatus.PUBLISHED, NetworkStatus.DRAFT, {});
  });

  it('item yang sudah PUBLISHED → skipped, tanpa menulis status', async () => {
    const { service, findById, updateStatusIf } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.PUBLISHED));

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.PUBLISHED, ['network:update', 'network:approve']),
    ).resolves.toEqual({ updated: 0, skipped: 1, failed: 0 });
    expect(updateStatusIf).not.toHaveBeenCalled();
  });

  it('PUBLISHED dengan network:update saja → 403, tanpa menyentuh repository', async () => {
    const { service, findById, updateStatusIf } = makeService();

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.PUBLISHED, ['network:update']),
    ).rejects.toThrow(ForbiddenException);
    expect(findById).not.toHaveBeenCalled();
    expect(updateStatusIf).not.toHaveBeenCalled();
  });

  it('APPROVED sebagai target → 400 BadRequest', async () => {
    const { service } = makeService();

    await expect(service.bulkUpdateStatus(['a'], NetworkStatus.APPROVED, ['network:approve'])).rejects.toThrow(
      'Bulk status target APPROVED is not supported',
    );
  });

  it('REQUEST tanpa network:update → 403, tanpa menyentuh repository', async () => {
    const { service, findById } = makeService();

    await expect(service.bulkUpdateStatus(['a'], NetworkStatus.REQUEST, ['network:reject'])).rejects.toThrow(
      'Bulk status REQUEST requires permission network:update',
    );
    expect(findById).not.toHaveBeenCalled();
  });

  it('DRAFT dengan network:reject saja: kandidat unpublish tidak dipakai (PUBLISHED skipped)', async () => {
    const { service, findById, updateStatusIf } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.PUBLISHED));

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.DRAFT, ['network:update', 'network:reject']),
    ).resolves.toEqual({ updated: 0, skipped: 1, failed: 0 });
    expect(updateStatusIf).not.toHaveBeenCalled();
  });

  it('DRAFT dengan network:unpublish saja: tetap jalankan unpublish', async () => {
    const { service, findById, updateStatusIf } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.PUBLISHED));
    updateStatusIf.mockResolvedValue(row(NetworkStatus.DRAFT));

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.DRAFT, ['network:update', 'network:unpublish']),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith('a', NetworkStatus.PUBLISHED, NetworkStatus.DRAFT, {});
  });

  it('DRAFT dari REQUEST lewat reject bila hanya network:reject dipegang', async () => {
    const { service, findById, updateStatusIf } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.REQUEST));
    updateStatusIf.mockResolvedValue(row(NetworkStatus.DRAFT));

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.DRAFT, ['network:reject']),
    ).resolves.toEqual({ updated: 1, skipped: 0, failed: 0 });
    expect(updateStatusIf).toHaveBeenCalledWith('a', NetworkStatus.REQUEST, NetworkStatus.DRAFT, {});
  });

  it('DRAFT dengan network:approve saja → 403 (approve tak boleh unpublish)', async () => {
    const { service, findById } = makeService();

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.DRAFT, ['network:update', 'network:approve']),
    ).rejects.toThrow('Bulk status DRAFT requires permission network:reject or network:unpublish');
    expect(findById).not.toHaveBeenCalled();
  });

  it('row tidak ditemukan (404) → skipped', async () => {
    const { service, findById, updateStatusIf } = makeService();
    findById.mockRejectedValue(new NotFoundException('Network not found'));

    await expect(
      service.bulkUpdateStatus(['a'], NetworkStatus.DRAFT, ['network:update', 'network:reject']),
    ).resolves.toEqual({ updated: 0, skipped: 1, failed: 0 });
    expect(updateStatusIf).not.toHaveBeenCalled();
  });
});

describe('NetworkService.transition', () => {
  it('submit pada row non-DRAFT (REQUEST) → 409 Conflict', async () => {
    const { service, findById, updateStatusIf, notifyAdmins } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.REQUEST));

    await expect(service.transition('a', 'submit')).rejects.toThrow(ConflictException);
    expect(updateStatusIf).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('submit DRAFT → REQUEST mengirim notifikasi admin satu kali', async () => {
    const { service, findById, updateStatusIf, notifyAdmins } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.DRAFT, { submitterEmail: 'a@example.com' }));
    updateStatusIf.mockResolvedValue(row(NetworkStatus.REQUEST, { submitterEmail: 'a@example.com' }));

    await expect(service.transition('a', 'submit')).resolves.toEqual(
      row(NetworkStatus.REQUEST, { submitterEmail: 'a@example.com' }),
    );
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
    expect(notifyAdmins).toHaveBeenCalledWith({
      type: NotificationType.CONTENT_SUBMITTED,
      entityType: NotificationEntityType.NETWORK,
      entityId: 'a',
      title: 'Gamelan',
      details: [
        { label: 'Submitted by', value: 'Gamelan' },
        { label: 'Email', value: 'a@example.com' },
        { label: 'Type', value: 'Network' },
      ],
      imageUrl: null,
      linkPath: '/networks',
    });
  });

  it('submit DRAFT → REQUEST tanpa submitterEmail tetap mengirim (nilai null diteruskan)', async () => {
    const { service, findById, updateStatusIf, notifyAdmins } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.DRAFT));
    updateStatusIf.mockResolvedValue(row(NetworkStatus.REQUEST));

    await service.transition('a', 'submit');
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
    expect(notifyAdmins.mock.calls[0][0].details).toContainEqual({ label: 'Email', value: undefined });
  });

  it('approve/reject/unpublish tidak mengirim notifikasi admin', async () => {
    const cases: Array<[Parameters<NetworkService['transition']>[1], NetworkStatus, NetworkStatus]> = [
      ['approve', NetworkStatus.REQUEST, NetworkStatus.PUBLISHED],
      ['reject', NetworkStatus.REQUEST, NetworkStatus.DRAFT],
      ['unpublish', NetworkStatus.PUBLISHED, NetworkStatus.DRAFT],
    ];
    for (const [action, from, to] of cases) {
      const { service, findById, updateStatusIf, notifyAdmins } = makeService();
      findById.mockResolvedValue(row(from));
      updateStatusIf.mockResolvedValue(row(to));

      await service.transition('a', action);
      expect(notifyAdmins).not.toHaveBeenCalled();
    }
  });

  it('approve pada DRAFT → PUBLISHED, predicate = status aktual, kedua timestamp terisi', async () => {
    const { service, findById, updateStatusIf } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.DRAFT));
    updateStatusIf.mockResolvedValue(row(NetworkStatus.PUBLISHED));

    await expect(service.transition('a', 'approve')).resolves.toEqual(row(NetworkStatus.PUBLISHED));
    expect(updateStatusIf).toHaveBeenCalledWith('a', NetworkStatus.DRAFT, NetworkStatus.PUBLISHED, {
      publishedAt: expect.any(Date),
      approvedAt: expect.any(Date),
    });
  });

  it('approve pada REQUEST → PUBLISHED tetap jalan', async () => {
    const { service, findById, updateStatusIf } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.REQUEST));
    updateStatusIf.mockResolvedValue(row(NetworkStatus.PUBLISHED));

    await expect(service.transition('a', 'approve')).resolves.toEqual(row(NetworkStatus.PUBLISHED));
    expect(updateStatusIf).toHaveBeenCalledWith('a', NetworkStatus.REQUEST, NetworkStatus.PUBLISHED, {
      publishedAt: expect.any(Date),
      approvedAt: expect.any(Date),
    });
  });

  it('approve pada APPROVED → 409, tanpa menulis status', async () => {
    const { service, findById, updateStatusIf } = makeService();
    findById.mockResolvedValue(row(NetworkStatus.APPROVED));

    await expect(service.transition('a', 'approve')).rejects.toThrow(ConflictException);
    expect(updateStatusIf).not.toHaveBeenCalled();
  });

  it('balapan status (updateStatusIf null) → 409 dari status terbaru', async () => {
    const { service, findById, updateStatusIf } = makeService();
    findById.mockResolvedValueOnce(row(NetworkStatus.DRAFT)).mockResolvedValueOnce(row(NetworkStatus.REQUEST));
    updateStatusIf.mockResolvedValue(null);

    await expect(service.transition('a', 'approve')).rejects.toThrow(
      'Cannot approve network in status REQUEST',
    );
  });
});
