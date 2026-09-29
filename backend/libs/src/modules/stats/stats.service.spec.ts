import { PrismaService } from '@app/libs/core/database/prisma.service';
import { StatsCountrySource } from './entities/stats.entity';
import { StatsRepository } from './stats.repository';
import { mapCountrySummary } from './stats.service';

describe('stats country summary', () => {
  describe('mapCountrySummary', () => {
    it('unions iso2, name and member code to the same country without double-count', () => {
      const source: StatsCountrySource = {
        countries: [{ id: 1, iso2: 'ID', name: 'Indonesia' }],
        postCountryCodes: ['ID'],
        eventCountryCodes: ['ID'],
        memberCountryCodes: ['ID'],
        networkCountryNames: [' indonesia '],
      };

      expect(mapCountrySummary(source)).toEqual({
        story: 1,
        event: 1,
        organization: 1,
        member: 1,
        total: 1,
      });
    });

    it('keeps collisions on Country.name (union all ids) and trims both sides', () => {
      const source: StatsCountrySource = {
        countries: [
          { id: 1, iso2: 'ID', name: ' Indonesia ' },
          { id: 2, iso2: 'US', name: 'indonesia' }, // nama sama → jangan overwrite
          { id: 3, iso2: 'MY', name: 'Malaysia' },
        ],
        postCountryCodes: ['ID'],
        eventCountryCodes: [],
        memberCountryCodes: ['ID', 'US'],
        networkCountryNames: ['INDONESIA', 'malaysia'],
      };

      expect(mapCountrySummary(source)).toEqual({
        story: 1,
        event: 0,
        organization: 3,
        member: 2,
        total: 3,
      });
    });
  });

  describe('StatsRepository.findCountrySummary', () => {
    const buildRepository = (data: {
      posts?: unknown[];
      events?: unknown[];
      users?: unknown[];
      networks?: unknown[];
      countries?: unknown[];
    }) => {
      const prisma = {
        post: { findMany: jest.fn().mockResolvedValue(data.posts ?? []) },
        event: { findMany: jest.fn().mockResolvedValue(data.events ?? []) },
        user: { findMany: jest.fn().mockResolvedValue(data.users ?? []) },
        network: { findMany: jest.fn().mockResolvedValue(data.networks ?? []) },
        country: { findMany: jest.fn().mockResolvedValue(data.countries ?? []) },
      };
      return new StatsRepository(prisma as unknown as PrismaService);
    };

    it('falls back to creator only when no author has a countryId', async () => {
      const repository = buildRepository({
        posts: [
          // author tanpa country → fallback creator
          { creator: { countryId: 'US' }, authors: [{ author: { countryId: null } }] },
          // author punya country → creator diabaikan
          { creator: { countryId: 'MY' }, authors: [{ author: { countryId: 'ID' } }] },
        ],
      });

      const source = await repository.findCountrySummary(new Date());

      expect([...source.postCountryCodes].sort()).toEqual(['ID', 'US']);
      expect(source.eventCountryCodes).toEqual([]);
    });
  });
});
