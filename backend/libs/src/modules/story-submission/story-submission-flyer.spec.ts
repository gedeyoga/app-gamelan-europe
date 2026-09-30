import { StorySubmissionService } from './story-submission.service';

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';

function makeService(
  overrides: {
    storySubmissionRepository?: Record<string, unknown>;
    imageRepository?: Record<string, unknown>;
  } = {},
) {
  return new StorySubmissionService(
    (overrides.storySubmissionRepository ?? {}) as never,
    { findByIds: jest.fn().mockResolvedValue([]) } as never, // categoryRepository
    { findByIdOrNull: jest.fn().mockResolvedValue({ id: 101 }) } as never,
    {} as never, // stateRepository
    (overrides.imageRepository ?? { findByIds: jest.fn().mockResolvedValue([]) }) as never,
    { toImageResponse: (image: unknown) => image } as never,
  );
}

const submitter = { fullName: 'Budi', email: 'budi@example.com', countryId: 101 };

describe('StorySubmissionService flyerItems', () => {
  it('create: duplicate type (case-insensitive) → 422 flyerItems.1.type', async () => {
    const service = makeService();
    await expect(
      service.create({
        name: 'S',
        content: 'x',
        submitter,
        flyerItems: [
          { type: 'Flyer', imageIds: [] },
          { type: 'flyer', imageIds: [] },
        ],
      } as never),
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
      service.create({
        name: 'S',
        content: 'x',
        submitter,
        flyerItems: [
          { type: 'flyer', imageIds: [UUID_1] },
          { type: 'poster', imageIds: [UUID_1] },
        ],
      } as never),
    ).rejects.toMatchObject({
      response: {
        errors: [{ field: 'flyerItems.1.imageIds.0', message: 'image id must be unique' }],
      },
    });
  });

  it('create: legacy flyerImageIds → satu grup `flyer`', async () => {
    const create = jest.fn().mockResolvedValue({ id: 's1', status: 'REQUEST' });
    const imageRepository = {
      findByIds: jest.fn().mockResolvedValue([
        { id: UUID_1, entityType: 'story-submission', entityId: null },
      ]),
    };
    const service = makeService({ storySubmissionRepository: { create }, imageRepository });

    await service.create({ name: 'S', content: 'x', submitter, flyerImageIds: [UUID_1] } as never);

    expect(create.mock.calls[0][0].flyerItems).toEqual([{ type: 'flyer', imageIds: [UUID_1] }]);
  });

  it('create: legacy flyerImageIds duplikat → 422 flyerImageIds.1', async () => {
    const service = makeService();
    await expect(
      service.create({ name: 'S', content: 'x', submitter, flyerImageIds: [UUID_1, UUID_1] } as never),
    ).rejects.toMatchObject({
      response: {
        message: 'Validation failed',
        errors: [{ field: 'flyerImageIds.1', message: 'image id must be unique' }],
      },
    });
  });

  it('create: flyer id bukan submission unbound → 422 flyerItems.0.imageIds.0', async () => {
    const service = makeService({
      imageRepository: {
        findByIds: jest
          .fn()
          .mockResolvedValue([{ id: UUID_1, entityType: 'post', entityId: 'p1' }]),
      },
    });
    await expect(
      service.create({
        name: 'S',
        content: 'x',
        submitter,
        flyerItems: [{ type: 'flyer', imageIds: [UUID_1] }],
      } as never),
    ).rejects.toMatchObject({
      response: {
        errors: [
          { field: 'flyerItems.0.imageIds.0', message: 'image not found, wrong type, or already bound' },
        ],
      },
    });
  });

  it('detail: resolve tiap grup berurut, skip id hilang, `flyerItems` mentah tidak bocor', async () => {
    const submission = {
      id: 's1',
      name: 'S',
      content: '<p>x</p>',
      categoryIds: [],
      galleryImageIds: [UUID_2],
      flyerItems: [
        { type: 'flyer', imageIds: [UUID_1, 'missing'] },
        { type: 'poster', imageIds: [] },
      ],
      thumbnail: null,
      status: 'REQUEST',
      adminNote: null,
      reviewedBy: null,
      reviewedAt: null,
      postId: null,
      post: null,
      submitter: { fullName: 'B', email: 'e', countryId: 101, stateId: null, country: null, state: null },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = makeService({
      storySubmissionRepository: { findById: jest.fn().mockResolvedValue(submission) },
      imageRepository: { findByIds: jest.fn().mockResolvedValue([{ id: UUID_1 }, { id: UUID_2 }]) },
    });

    const result = await service.findOne('s1');

    expect(result.flyer).toEqual([
      { type: 'flyer', images: [{ id: UUID_1 }] },
      { type: 'poster', images: [] },
    ]);
    expect(result.flyerCount).toBe(2); // id flattened, bukan jumlah grup
    expect((result as Record<string, unknown>).flyerItems).toBeUndefined();
  });
});
