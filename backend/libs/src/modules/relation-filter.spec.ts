import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { PostService } from './post/post.service';
import { EventService } from './event/event.service';
import { ListPostsQueryDto } from './post/dto/list-posts-query.dto';
import { ListEventsQueryDto } from './event/dto/list-events-query.dto';

// Filter relasi harus di-AND dengan scopeWhere (bukan mengganti) agar row-level RBAC tetap berlaku.
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_TYPE_ID = '22222222-2222-4222-8222-222222222222';
const networkScope = { kind: 'network', networkId: 'net-1', canViewPrivate: true, isMember: true };

function makePostService(scope: unknown) {
  const findMany = jest.fn().mockResolvedValue({ items: [], total: 0 });
  const service = new PostService(
    { findMany } as never,
    { findByIds: jest.fn().mockResolvedValue([]) } as never,
    { toImageResponse: (image: unknown) => image } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { resolve: jest.fn().mockResolvedValue(scope) } as unknown as AccessScopeService,
  );
  return { service, findMany };
}

function makeEventService(scope: unknown) {
  const findMany = jest.fn().mockResolvedValue({ items: [], total: 0 });
  const service = new EventService(
    { findMany } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { resolve: jest.fn().mockResolvedValue(scope) } as unknown as AccessScopeService,
  );
  return { service, findMany };
}

describe('PostService list: categoryId relation filter', () => {
  it('AND dengan scopeWhere (scope tidak diganti)', async () => {
    const { service, findMany } = makePostService(networkScope);
    await service.list(
      { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc', categoryId: CATEGORY_ID } as ListPostsQueryDto,
      'user',
    );
    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { creator: { networkId: 'net-1' } },
        { categories: { some: { categoryId: CATEGORY_ID } } },
      ]),
    );
  });

  it('categoryId invalid → 422', async () => {
    const errors = await validate(plainToInstance(ListPostsQueryDto, { categoryId: 'not-a-uuid' }));
    expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
    const ok = await validate(plainToInstance(ListPostsQueryDto, { categoryId: CATEGORY_ID }));
    expect(ok).toHaveLength(0);
  });
});

describe('EventService list: eventTypeId relation filter', () => {
  it('AND dengan scopeWhere (scope tidak diganti)', async () => {
    const { service, findMany } = makeEventService(networkScope);
    await service.list(
      { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc', eventTypeId: EVENT_TYPE_ID } as ListEventsQueryDto,
      'user',
    );
    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { creator: { networkId: 'net-1' } },
        { eventTypes: { some: { eventTypeId: EVENT_TYPE_ID } } },
      ]),
    );
  });

  it('eventTypeId invalid → 422', async () => {
    const errors = await validate(plainToInstance(ListEventsQueryDto, { eventTypeId: 'not-a-uuid' }));
    expect(errors.some((e) => e.property === 'eventTypeId')).toBe(true);
    const ok = await validate(plainToInstance(ListEventsQueryDto, { eventTypeId: EVENT_TYPE_ID }));
    expect(ok).toHaveLength(0);
  });
});
