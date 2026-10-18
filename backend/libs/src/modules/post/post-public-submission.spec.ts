import { PostService } from './post.service';
import type { PostRepository } from './post.repository';

const COUNTRY_ID = 1;
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';

// Cek path submit publik: tulis Post REQUEST + source PUBLIC oleh user hasil find-or-create.
describe('PostService.createPublicSubmission', () => {
  function makeService() {
    const postRepository = {
      existsBySlug: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue({ id: 'p1', status: 'REQUEST' }),
    };
    const imageRepository = { filterBindableIds: jest.fn(async (ids: string[]) => ids) };
    const userService = { findOrCreatePublicUser: jest.fn().mockResolvedValue({ id: 'u1' }) };
    const categoryRepository = {
      findByIds: jest.fn().mockResolvedValue([{ id: CATEGORY_ID, type: 'STORY' }]),
    };
    const countryRepository = {
      findByIdOrNull: jest.fn().mockResolvedValue({ id: COUNTRY_ID, iso2: 'ID', name: 'Indonesia' }),
    };
    const notificationService = {
      publishAfterCommit: jest.fn(),
      enqueueContentPublished: jest.fn(),
      enqueuePending: jest.fn(),
      notifyAdmins: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PostService(
      postRepository as unknown as PostRepository,
      imageRepository as never,
      { isTrustedUnboundUrl: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
      userService as never,
      categoryRepository as never,
      countryRepository as never,
      {} as never,
      {} as never,
      {} as never,
      notificationService as never,
    );
    return { service, postRepository, userService, notificationService };
  }

  it('menyimpan status REQUEST + source PUBLIC + author user publik', async () => {
    const { service, postRepository, userService, notificationService } = makeService();

    const result = await service.createPublicSubmission({
      name: 'Kisah Gamelan',
      content: '<p>halo</p>',
      categoryIds: [CATEGORY_ID],
      submitter: { fullName: 'Anon', email: 'anon@example.com', countryId: COUNTRY_ID },
    } as never);

    expect(result).toEqual({ id: 'p1', status: 'REQUEST' });
    expect(userService.findOrCreatePublicUser).toHaveBeenCalledWith({
      fullName: 'Anon',
      email: 'anon@example.com',
      countryId: 'ID',
      stateId: null,
    });
    expect(postRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'REQUEST',
        source: 'PUBLIC',
        createdBy: 'u1',
        authorIds: ['u1'],
        categoryIds: [CATEGORY_ID],
      }),
    );
    expect(notificationService.notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'POST', entityId: 'p1', title: 'Kisah Gamelan' }),
    );
  });
});
