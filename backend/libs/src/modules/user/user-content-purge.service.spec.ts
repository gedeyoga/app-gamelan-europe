import { NotFoundException } from '@nestjs/common';
import { UserContentPurgeService } from './user-content-purge.service';

type Mocks = ReturnType<typeof makeMocks>;

function makeMocks() {
  return {
    userService: {
      findOne: jest.fn().mockResolvedValue({ id: 'u1' }),
      remove: jest.fn().mockResolvedValue({ id: 'u1' }),
    },
    postRepository: { findIdsByAuthorId: jest.fn().mockResolvedValue([]) },
    eventRepository: { findIdsByAuthorId: jest.fn().mockResolvedValue([]) },
    archiveRepository: { findIdsByAuthorId: jest.fn().mockResolvedValue([]) },
    postService: { remove: jest.fn().mockResolvedValue(undefined) },
    eventService: { remove: jest.fn().mockResolvedValue(undefined) },
    archiveService: { remove: jest.fn().mockResolvedValue(undefined) },
  };
}

function makeService(mocks: Mocks): UserContentPurgeService {
  return new UserContentPurgeService(
    mocks.userService as never,
    mocks.postRepository as never,
    mocks.eventRepository as never,
    mocks.archiveRepository as never,
    mocks.postService as never,
    mocks.eventService as never,
    mocks.archiveService as never,
  );
}

describe('UserContentPurgeService', () => {
  it('cascade=false → delete user saja, tanpa query/delete konten', async () => {
    const mocks = makeMocks();
    await makeService(mocks).remove('u1', 'admin', false);

    expect(mocks.userService.remove).toHaveBeenCalledWith('u1', 'admin');
    expect(mocks.userService.findOne).not.toHaveBeenCalled();
    expect(mocks.postRepository.findIdsByAuthorId).not.toHaveBeenCalled();
    expect(mocks.eventRepository.findIdsByAuthorId).not.toHaveBeenCalled();
    expect(mocks.archiveRepository.findIdsByAuthorId).not.toHaveBeenCalled();
    expect(mocks.postService.remove).not.toHaveBeenCalled();
    expect(mocks.eventService.remove).not.toHaveBeenCalled();
    expect(mocks.archiveService.remove).not.toHaveBeenCalled();
  });

  it('flag absen (undefined) → perilaku delete default', async () => {
    const mocks = makeMocks();
    await makeService(mocks).remove('u1', 'admin');

    expect(mocks.userService.remove).toHaveBeenCalledWith('u1', 'admin');
    expect(mocks.postRepository.findIdsByAuthorId).not.toHaveBeenCalled();
    expect(mocks.postService.remove).not.toHaveBeenCalled();
  });

  it('cascade=true → hapus tepat id per modul (post, event, archive), user terakhir', async () => {
    const mocks = makeMocks();
    mocks.postRepository.findIdsByAuthorId.mockResolvedValue(['p1', 'p2']);
    mocks.eventRepository.findIdsByAuthorId.mockResolvedValue(['e1']);
    mocks.archiveRepository.findIdsByAuthorId.mockResolvedValue(['a1', 'a2', 'a3']);
    await makeService(mocks).remove('u1', 'admin', true);

    expect(mocks.postService.remove.mock.calls).toEqual([
      ['p1', 'admin', { skipScopeCheck: true }],
      ['p2', 'admin', { skipScopeCheck: true }],
    ]);
    expect(mocks.eventService.remove.mock.calls).toEqual([
      ['e1', 'admin', { skipScopeCheck: true }],
    ]);
    expect(mocks.archiveService.remove.mock.calls).toEqual([
      ['a1', 'admin', { skipScopeCheck: true }],
      ['a2', 'admin', { skipScopeCheck: true }],
      ['a3', 'admin', { skipScopeCheck: true }],
    ]);
    expect(mocks.postService.remove).toHaveBeenCalledTimes(2);
    expect(mocks.eventService.remove).toHaveBeenCalledTimes(1);
    expect(mocks.archiveService.remove).toHaveBeenCalledTimes(3);
    expect(mocks.userService.findOne).toHaveBeenCalledWith('u1', 'admin');
    expect(mocks.userService.remove).toHaveBeenCalledWith('u1', 'admin');
    // urutan: resolve → purge konten → hapus user
    expect(mocks.userService.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.postService.remove.mock.invocationCallOrder[0],
    );
    expect(mocks.archiveService.remove.mock.invocationCallOrder[2]).toBeLessThan(
      mocks.userService.remove.mock.invocationCallOrder[0],
    );
  });

  it('delete konten gagal → error propagate, user TIDAK dihapus', async () => {
    const mocks = makeMocks();
    mocks.postRepository.findIdsByAuthorId.mockResolvedValue(['p1', 'p2']);
    mocks.postService.remove
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage down'));
    const service = makeService(mocks);

    await expect(service.remove('u1', 'admin', true)).rejects.toThrow('storage down');
    expect(mocks.postService.remove).toHaveBeenCalledTimes(2);
    expect(mocks.eventService.remove).not.toHaveBeenCalled();
    expect(mocks.archiveService.remove).not.toHaveBeenCalled();
    expect(mocks.userService.remove).not.toHaveBeenCalled();
  });

  it('user tidak ada → 404 sebelum purge apa pun', async () => {
    const mocks = makeMocks();
    mocks.userService.findOne.mockRejectedValue(new NotFoundException('User not found'));
    const service = makeService(mocks);

    await expect(service.remove('missing', 'admin', true)).rejects.toMatchObject({ status: 404 });
    expect(mocks.postRepository.findIdsByAuthorId).not.toHaveBeenCalled();
    expect(mocks.postService.remove).not.toHaveBeenCalled();
    expect(mocks.eventService.remove).not.toHaveBeenCalled();
    expect(mocks.archiveService.remove).not.toHaveBeenCalled();
    expect(mocks.userService.remove).not.toHaveBeenCalled();
  });

  it('self-delete → 403 sebelum purge apa pun (tanpa partial delete)', async () => {
    const mocks = makeMocks();
    const service = makeService(mocks);

    await expect(service.remove('u1', 'u1', true)).rejects.toMatchObject({ status: 403 });
    expect(mocks.userService.findOne).not.toHaveBeenCalled();
    expect(mocks.postRepository.findIdsByAuthorId).not.toHaveBeenCalled();
    expect(mocks.postService.remove).not.toHaveBeenCalled();
    expect(mocks.eventService.remove).not.toHaveBeenCalled();
    expect(mocks.archiveService.remove).not.toHaveBeenCalled();
    expect(mocks.userService.remove).not.toHaveBeenCalled();
  });
});
