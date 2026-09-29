import { Injectable } from '@nestjs/common';
import { StatsRepository } from './stats.repository';
import { StatsCountrySource, StatsCountrySummary, StatsSummary } from './entities/stats.entity';

/**
 * Mapping mentah→ringkasan: iso2→Country.id, name→Country.id (trim, anti-kolisi),
 * lalu union distinct by id. Pure agar mudah ditest.
 */
export function mapCountrySummary(source: StatsCountrySource): StatsCountrySummary {
  const idByIso2 = new Map<string, number>();
  const idsByName = new Map<string, Set<number>>();
  for (const country of source.countries) {
    idByIso2.set(country.iso2.trim(), country.id);
    const key = country.name.trim().toLowerCase();
    const ids = idsByName.get(key) ?? new Set<number>();
    ids.add(country.id);
    idsByName.set(key, ids);
  }

  const byIso2 = (codes: string[]): Set<number> => {
    const ids = new Set<number>();
    for (const code of codes) {
      const id = idByIso2.get(code.trim());
      if (id !== undefined) ids.add(id);
    }
    return ids;
  };

  const story = byIso2(source.postCountryCodes);
  const event = byIso2(source.eventCountryCodes);
  const member = byIso2(source.memberCountryCodes);

  const organization = new Set<number>();
  for (const name of source.networkCountryNames) {
    const ids = idsByName.get(name.trim().toLowerCase());
    if (ids) for (const id of ids) organization.add(id);
  }

  const total = new Set<number>([...story, ...event, ...member, ...organization]);

  return {
    story: story.size,
    event: event.size,
    organization: organization.size,
    member: member.size,
    total: total.size,
  };
}

@Injectable()
export class StatsService {
  constructor(private readonly statsRepository: StatsRepository) {}

  async getSummary(): Promise<StatsSummary> {
    const now = new Date();
    const [published, latestPublishedAt, active, countrySource] = await Promise.all([
      this.statsRepository.countPublishedEvents(now),
      this.statsRepository.latestPublishedAt(now),
      this.statsRepository.countActiveUsers(),
      this.statsRepository.findCountrySummary(now),
    ]);

    return {
      events: { published, latestPublishedAt },
      users: { active },
      countries: mapCountrySummary(countrySource),
    };
  }
}
