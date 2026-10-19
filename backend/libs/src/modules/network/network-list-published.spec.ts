import { NetworkService } from './network.service';
import type { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

function makeService() {
  const findMany = jest.fn().mockResolvedValue({ items: [], total: 0 });
  const service = new NetworkService(
    { findMany } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, findMany };
}

function query(filter?: Record<string, unknown>): ListQueryDto {
  return { page: 1, limit: 20, filter } as ListQueryDto;
}

describe('NetworkService.list filter status=PUBLISHED', () => {
  it('menambahkan publishedAt != null AND <= now', async () => {
    const { service, findMany } = makeService();
    await service.list(query({ status: 'PUBLISHED' }));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          publishedAt: { not: null, lte: expect.any(Date) },
        },
      }),
    );
  });

  it('status lain tidak dibatasi publishedAt', async () => {
    const { service, findMany } = makeService();
    await service.list(query({ status: 'DRAFT' }));
    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.publishedAt).toBeUndefined();
  });
});
