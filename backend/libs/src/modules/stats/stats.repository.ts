import { Injectable } from '@nestjs/common';
import { ContentStatus, ContentVisibility, UserStatus } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { StatsCountrySource } from './entities/stats.entity';

@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countPublishedEvents(now: Date): Promise<number> {
    return this.prisma.event.count({
      where: { status: ContentStatus.PUBLISHED, publishedAt: { not: null, lte: now } },
    });
  }

  async latestPublishedAt(now: Date): Promise<Date | null> {
    const latest = await this.prisma.event.findFirst({
      where: { status: ContentStatus.PUBLISHED, publishedAt: { not: null, lte: now } },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });
    return latest?.publishedAt ?? null;
  }

  countActiveUsers(): Promise<number> {
    return this.prisma.user.count({ where: { status: UserStatus.ACTIVE } });
  }

  /** Query Prisma mentah; mapping id/union ada di StatsService. */
  async findCountrySummary(now: Date): Promise<StatsCountrySource> {
    const [postCountryCodes, eventCountryCodes, memberCountryCodes, networkCountryNames, countries] =
      await Promise.all([
        this.postCountryCodes(now),
        this.eventCountryCodes(now),
        this.userCountryCodes(),
        this.networkCountryNames(),
        this.prisma.country.findMany({ select: { id: true, iso2: true, name: true } }),
      ]);

    return { countries, postCountryCodes, eventCountryCodes, memberCountryCodes, networkCountryNames };
  }

  private async postCountryCodes(now: Date): Promise<string[]> {
    // ponytail: full scan Post PUBLISHED ke memori (select kolom sempit). Cukup untuk skala
    // sekarang; upgrade ke agregasi SQL (`SELECT DISTINCT`/`UNION`) atau CacheService TTL bila
    // tabel membesar.
    const posts = await this.prisma.post.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        publishedAt: { not: null, lte: now },
        visibility: ContentVisibility.PUBLIC,
      },
      select: {
        creator: { select: { countryId: true } },
        authors: { select: { author: { select: { countryId: true } } } },
      },
    });
    const codes = new Set<string>();
    for (const post of posts) {
      const authorCodes = post.authors
        .map(({ author }) => author.countryId)
        .filter((code): code is string => code !== null);
      const resolved =
        authorCodes.length > 0 ? authorCodes : post.creator?.countryId ? [post.creator.countryId] : [];
      for (const code of resolved) codes.add(code);
    }
    return [...codes];
  }

  private async eventCountryCodes(now: Date): Promise<string[]> {
    // ponytail: full scan Event PUBLISHED ke memori (select kolom sempit). Cukup untuk skala
    // sekarang; upgrade ke agregasi SQL (`SELECT DISTINCT`/`UNION`) atau CacheService TTL bila
    // tabel membesar.
    const events = await this.prisma.event.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        publishedAt: { not: null, lte: now },
        visibility: ContentVisibility.PUBLIC,
      },
      select: {
        creator: { select: { countryId: true } },
        authors: { select: { author: { select: { countryId: true } } } },
      },
    });
    const codes = new Set<string>();
    for (const event of events) {
      const authorCodes = event.authors
        .map(({ author }) => author.countryId)
        .filter((code): code is string => code !== null);
      const resolved =
        authorCodes.length > 0 ? authorCodes : event.creator?.countryId ? [event.creator.countryId] : [];
      for (const code of resolved) codes.add(code);
    }
    return [...codes];
  }

  private async userCountryCodes(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { countryId: { not: null } },
      select: { countryId: true },
      distinct: ['countryId'],
    });
    return users.flatMap((user) => (user.countryId ? [user.countryId] : []));
  }

  private async networkCountryNames(): Promise<string[]> {
    const networks = await this.prisma.network.findMany({
      where: { country: { not: null } },
      select: { country: true },
      distinct: ['country'],
    });
    return networks.flatMap((network) => (network.country ? [network.country] : []));
  }
}
