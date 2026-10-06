import { ForbiddenException } from '@nestjs/common';
import type { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { ArchiveService } from '../archive/archive.service';
import { EventService } from '../event/event.service';
import { PostService } from './post.service';

// Scope `own` milik aktor lain → `assertWritable` harus menolak, kecuali `skipScopeCheck` eksplisit.
const ownScope = () => ({
  resolve: jest.fn().mockResolvedValue({ kind: 'own', userId: 'actor', canViewPrivate: false }),
});

function makePostService() {
  const post = {
    id: 'p1',
    createdBy: 'someone-else',
    creator: null,
    galleryImageIds: [],
    flyerItems: [],
  };
  const postRepository = {
    findById: jest.fn().mockResolvedValue(post),
    delete: jest.fn().mockResolvedValue(post),
  };
  const imageRepository = {
    findByIds: jest.fn().mockResolvedValue([]),
    deleteByEntity: jest.fn().mockResolvedValue(['key-1']),
  };
  const storage = { deleteObjects: jest.fn().mockResolvedValue(undefined) };
  const service = new PostService(
    postRepository as never,
    imageRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    storage as never,
    ownScope() as unknown as AccessScopeService,
  );
  return { service, postRepository, imageRepository, storage };
}

function makeEventService() {
  const event = { id: 'e1', creator: null };
  const eventRepository = {
    findById: jest.fn().mockResolvedValue(event),
    delete: jest.fn().mockResolvedValue(event),
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
    ownScope() as unknown as AccessScopeService,
  );
  return { service, eventRepository };
}

function makeArchiveService() {
  const archive = { id: 'a1', type: 'PUBLIC', externalLinks: [], documentIds: [], creator: null };
  const archiveRepository = {
    findById: jest.fn().mockResolvedValue(archive),
    delete: jest.fn().mockResolvedValue(archive),
  };
  const documentRepository = {
    findByIds: jest.fn().mockResolvedValue([]),
    findByEntity: jest.fn().mockResolvedValue([]),
  };
  const storage = { deleteObjects: jest.fn().mockResolvedValue(undefined) };
  const service = new ArchiveService(
    archiveRepository as never,
    {} as never,
    {} as never,
    documentRepository as never,
    {} as never,
    storage as never,
    ownScope() as unknown as AccessScopeService,
  );
  return { service, archiveRepository, documentRepository, storage };
}

describe('remove() tanpa opsi → scope check tetap ditegakkan (403, tanpa delete)', () => {
  it('PostService', async () => {
    const { service, postRepository, imageRepository, storage } = makePostService();
    await expect(service.remove('p1', 'actor')).rejects.toBeInstanceOf(ForbiddenException);
    expect(postRepository.delete).not.toHaveBeenCalled();
    expect(imageRepository.deleteByEntity).not.toHaveBeenCalled();
    expect(storage.deleteObjects).not.toHaveBeenCalled();
  });

  it('EventService', async () => {
    const { service, eventRepository } = makeEventService();
    await expect(service.remove('e1', 'actor')).rejects.toBeInstanceOf(ForbiddenException);
    expect(eventRepository.delete).not.toHaveBeenCalled();
  });

  it('ArchiveService', async () => {
    const { service, archiveRepository, documentRepository, storage } = makeArchiveService();
    await expect(service.remove('a1', 'actor')).rejects.toBeInstanceOf(ForbiddenException);
    expect(archiveRepository.delete).not.toHaveBeenCalled();
    expect(documentRepository.findByEntity).not.toHaveBeenCalled();
    expect(storage.deleteObjects).not.toHaveBeenCalled();
  });
});

describe('remove({ skipScopeCheck: true }) → hanya assertWritable yang dilewati', () => {
  it('PostService: delete + cleanup gambar/S3 tetap jalan', async () => {
    const { service, postRepository, imageRepository, storage } = makePostService();
    await service.remove('p1', 'actor', { skipScopeCheck: true });
    expect(postRepository.delete).toHaveBeenCalledWith('p1');
    expect(imageRepository.deleteByEntity).toHaveBeenCalledWith('post', 'p1');
    expect(storage.deleteObjects).toHaveBeenCalledWith(['key-1']);
  });

  it('EventService: delete tetap jalan', async () => {
    const { service, eventRepository } = makeEventService();
    await service.remove('e1', 'actor', { skipScopeCheck: true });
    expect(eventRepository.delete).toHaveBeenCalledWith('e1');
  });

  it('ArchiveService: delete + cleanup dokumen/S3 tetap jalan', async () => {
    const { service, archiveRepository, documentRepository, storage } = makeArchiveService();
    await service.remove('a1', 'actor', { skipScopeCheck: true });
    expect(archiveRepository.delete).toHaveBeenCalledWith('a1');
    expect(documentRepository.findByEntity).toHaveBeenCalledWith('archive', 'a1');
    expect(storage.deleteObjects).toHaveBeenCalled();
  });
});
