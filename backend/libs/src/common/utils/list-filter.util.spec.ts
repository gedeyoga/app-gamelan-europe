import { UnprocessableEntityException } from '@nestjs/common';
import { buildWhere, parseDateInput } from './list-filter.util';

const DATE_FIELDS = ['createdAt', 'updatedAt'];

describe('list-filter date coercion (UTC)', () => {
  it('ISO valid → Date (gte)', () => {
    const where = buildWhere<Record<string, unknown>>(
      { createdAt: { gte: '2026-09-01T00:00:00Z' } },
      ['createdAt'],
      { dateFields: DATE_FIELDS },
    );
    const cond = where['createdAt'] as { gte: unknown };
    expect(cond.gte).toBeInstanceOf(Date);
    expect((cond.gte as Date).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('Date langsung diteruskan sebagai Date', () => {
    const input = new Date('2026-09-01T00:00:00.000Z');
    expect(parseDateInput(input, 'createdAt')).toBe(input);
    const where = buildWhere<Record<string, unknown>>(
      { createdAt: input } as unknown as Record<string, unknown>,
      ['createdAt'],
      { dateFields: DATE_FIELDS },
    );
    expect(where['createdAt']).toBeInstanceOf(Date);
  });

  it('ISO invalid → 422', () => {
    try {
      buildWhere({ createdAt: { gte: 'not-a-date' } }, ['createdAt'], {
        dateFields: DATE_FIELDS,
      });
      fail('harus throw 422');
    } catch (e) {
      expect(e).toBeInstanceOf(UnprocessableEntityException);
      expect((e as UnprocessableEntityException).getStatus()).toBe(422);
      expect((e as UnprocessableEntityException).message).toContain(
        'Invalid ISO 8601 date for filter field "createdAt"',
      );
    }
  });

  it('in dengan satu elemen invalid → 422', () => {
    expect(() =>
      buildWhere(
        { createdAt: { in: '2026-09-01T00:00:00Z,not-a-date' } },
        ['createdAt'],
        { dateFields: DATE_FIELDS },
      ),
    ).toThrow(UnprocessableEntityException);
  });

  it('like di field tanggal → 422', () => {
    expect(() =>
      buildWhere({ createdAt: { like: '2026-09-01' } }, ['createdAt'], {
        dateFields: DATE_FIELDS,
      }),
    ).toThrow(UnprocessableEntityException);
  });

  it('non-tanggal tak terpengaruh (like + string apa adanya)', () => {
    const where = buildWhere<Record<string, unknown>>(
      { name: { like: 'adm' } },
      ['name', 'createdAt'],
      { dateFields: DATE_FIELDS },
    );
    expect(where['name']).toEqual({ contains: 'adm', mode: 'insensitive' });

    const eq = buildWhere<Record<string, unknown>>(
      { name: '2026-09-01' },
      ['name', 'createdAt'],
      { dateFields: DATE_FIELDS },
    );
    expect(eq['name']).toBe('2026-09-01');
  });
});
