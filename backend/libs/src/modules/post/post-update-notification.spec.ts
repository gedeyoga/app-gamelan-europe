import type { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { PostService } from './post.service';
import type { UpdatePostDto } from './dto/update-post.dto';

// Representative auto-publish via PATCH: `notify` DTO harus diteruskan ke notification service.
const existing = {
  id: 'p1',
  name: 'Judul',
  slug: 'judul',
  content: '<p>Isi</p>',
  thumbnail: null,
  status: 'DRAFT',
  visibility: 'PUBLIC',
  publishedAt: null,
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

function makeService() {
  const postRepository = {
    findById: jest.fn().mockResolvedValue(existing),
    update: jest.fn().mockResolvedValue({ ...existing, status: 'PUBLISHED', publishedAt: new Date() }),
  };
  const notificationService = { publishAfterCommit: jest.fn(), enqueuePending: jest.fn() };
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
    {
      resolve: jest.fn().mockResolvedValue({ kind: 'all', canViewPrivate: true, isMember: true }),
    } as unknown as AccessScopeService,
    notificationService as never,
  );
  return { service, notificationService };
}

describe('PostService.update auto-publish notify wiring', () => {
  it('notify:false diteruskan → NotificationService tidak enqueue', async () => {
    const { service, notificationService } = makeService();
    await service.update('p1', { status: 'PUBLISHED', notify: false } as UpdatePostDto, 'admin', ['story:publish']);
    expect(notificationService.publishAfterCommit).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'p1', notify: false }),
    );
  });

  it('default (undefined) → notify true', async () => {
    const { service, notificationService } = makeService();
    await service.update('p1', { status: 'PUBLISHED' } as UpdatePostDto, 'admin', ['story:publish']);
    expect(notificationService.publishAfterCommit).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'p1', notify: true }),
    );
  });
});
