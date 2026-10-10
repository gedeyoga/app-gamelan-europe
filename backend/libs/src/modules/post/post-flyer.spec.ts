import { PostService } from './post.service';
import { mapPost } from './entities/post.entity';

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';

const allScope = () => ({
  resolve: jest.fn().mockResolvedValue({ kind: 'all', userId: 'admin', canViewPrivate: true, isMember: false }),
});

function makeService(overrides: {
  postRepository?: Record<string, unknown>;
  imageRepository?: Record<string, unknown>;
} = {}) {
  return new PostService(
    (overrides.postRepository ?? {}) as never,
    (overrides.imageRepository ?? {}) as never,
    { toImageResponse: (image: unknown) => image } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    allScope() as never,
  );
}

describe('PostService flyerItems validation', () => {
  it('create: duplicate type (case-insensitive) → 422 flyerItems.1.type', async () => {
    const service = makeService();
    await expect(
      service.create(
        {
          name: 'Story',
          flyerItems: [
            { type: 'Flyer', imageIds: [] },
            { type: 'flyer', imageIds: [] },
          ],
        } as never,
        'admin',
      ),
    ).rejects.toMatchObject({
      response: {
        message: 'Validation failed',
        errors: [{ field: 'flyerItems.1.type', message: 'flyer type must be unique' }],
      },
    });
  });

  it('create: duplicate image id across groups → 422 flyerItems.1.imageIds.0', async () => {
    const service = makeService();
    await expect(
      service.create(
        {
          name: 'Story',
          flyerItems: [
            { type: 'Flyer', imageIds: [UUID_1] },
            { type: 'Poster', imageIds: [UUID_1] },
          ],
        } as never,
        'admin',
      ),
    ).rejects.toMatchObject({
      response: {
        errors: [{ field: 'flyerItems.1.imageIds.0', message: 'image id must be unique' }],
      },
    });
  });
});

describe('PostService hydrate flyer groups', () => {
  it('resolves each group in order and skips missing ids', async () => {
    const post = {
      id: 'p1',
      name: 'N',
      slug: 'n',
      status: 'DRAFT',
      publishedAt: null,
      approvedAt: null,
      content: '',
      thumbnail: null,
      visibility: 'PUBLIC',
      createdBy: 'u1',
      creator: null,
      categories: [],
      authors: [],
      galleryImageIds: [],
      flyerItems: [
        { type: 'Flyer', imageIds: [UUID_1, 'missing'] },
        { type: 'Poster', imageIds: [UUID_2] },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = makeService({
      postRepository: { findById: jest.fn().mockResolvedValue(post) },
      imageRepository: { findByIds: jest.fn().mockResolvedValue([{ id: UUID_1 }, { id: UUID_2 }]) },
    });

    const result = await service.findOne('p1', 'admin');

    expect(result.flyer).toEqual([
      { type: 'Flyer', images: [{ id: UUID_1 }] },
      { type: 'Poster', images: [{ id: UUID_2 }] },
    ]);
    expect((result as Record<string, unknown>).flyerItems).toBeUndefined();
  });
});

describe('PostService belum menyentuh data saat `null` dikirim (m1)', () => {
  it('create: flyerItems null tidak melempar & tidak di-bind', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'p1', galleryImageIds: [], flyerItems: [] });
    const service = makeService({
      postRepository: { create, existsBySlug: jest.fn().mockResolvedValue(false) },
      imageRepository: { filterBindableIds: jest.fn(), findByIds: jest.fn().mockResolvedValue([]) },
    });

    await service.create({ name: 'Story', flyerItems: null } as never, 'admin');

    const data = create.mock.calls[0][0];
    expect(data.flyerItems).toBeUndefined();
    expect(data.imageIds).toBeUndefined();
    expect(data.galleryImageIds).toBeUndefined();
  });

  it('update: flyerItems null → field tak diubah, tanpa unbind', async () => {
    const existing = {
      id: 'p1',
      createdBy: 'admin',
      creator: null,
      status: 'DRAFT',
      visibility: 'PUBLIC',
      publishedAt: null,
      approvedAt: null,
      galleryImageIds: [UUID_1],
      flyerItems: [{ type: 'F', imageIds: [UUID_2] }],
    };
    const update = jest.fn().mockResolvedValue(existing);
    const service = makeService({
      postRepository: { findById: jest.fn().mockResolvedValue(existing), update },
      imageRepository: { filterBindableIds: jest.fn(), findByIds: jest.fn().mockResolvedValue([]) },
    });

    await service.update('p1', { flyerItems: null } as never, 'admin');

    const data = update.mock.calls[0][1];
    expect(data.flyerItems).toBeUndefined();
    expect(data.removedFlyerImageIds).toBeUndefined();
  });
});

describe('PostService.update removed-image ids tidak melepas id yang masih dipakai (m2)', () => {
  const existingPost = (over: Record<string, unknown>) => ({
    id: 'p1',
    createdBy: 'admin',
    creator: null,
    status: 'DRAFT',
    visibility: 'PUBLIC',
    publishedAt: null,
    approvedAt: null,
    galleryImageIds: [],
    flyerItems: [],
    ...over,
  });

  function makeUpdateService(existing: Record<string, unknown>) {
    const update = jest.fn().mockResolvedValue(existing);
    const service = makeService({
      postRepository: { findById: jest.fn().mockResolvedValue(existing), update },
      imageRepository: {
        filterBindableIds: jest.fn((ids: string[]) => Promise.resolve(ids)),
        findByIds: jest.fn().mockResolvedValue([]),
      },
    });
    return { service, update };
  }

  it('id pindah flyer → galeri dalam request sama tetap ter-bind', async () => {
    const { service, update } = makeUpdateService(
      existingPost({ galleryImageIds: [], flyerItems: [{ type: 'F', imageIds: [UUID_1] }] }),
    );

    await service.update('p1', { galleryImageIds: [UUID_1], flyerItems: [] } as never, 'admin');

    const data = update.mock.calls[0][1];
    expect(data.removedFlyerImageIds).toEqual([]);
    expect(data.removedGalleryImageIds).toEqual([]);
  });

  it('id yang benar-benar keluar dari flyer tetap di-unbind', async () => {
    const { service, update } = makeUpdateService(
      existingPost({ galleryImageIds: [UUID_2], flyerItems: [{ type: 'F', imageIds: [UUID_1] }] }),
    );

    await service.update('p1', { flyerItems: [] } as never, 'admin');

    const data = update.mock.calls[0][1];
    expect(data.removedFlyerImageIds).toEqual([UUID_1]);
    expect(data.removedGalleryImageIds).toBeUndefined();
  });
});

describe('normalizeFlyerItems (m3)', () => {
  it('trim type & buang tipe kosong saat mapping JSONB legacy', () => {
    const row = {
      id: 'p1',
      name: 'N',
      slug: 'n',
      status: 'DRAFT',
      publishedAt: null,
      approvedAt: null,
      content: '',
      thumbnail: null,
      visibility: 'PUBLIC',
      createdBy: 'u1',
      creator: null,
      categories: [],
      authors: [],
      galleryImageIds: [],
      flyerItems: [
        { type: '  Flyer  ', imageIds: [UUID_1] },
        { type: '   ', imageIds: [UUID_2] },
        { type: 'Poster', imageIds: [] },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(mapPost(row as never).flyerItems).toEqual([
      { type: 'Flyer', imageIds: [UUID_1] },
      { type: 'Poster', imageIds: [] },
    ]);
  });
});
