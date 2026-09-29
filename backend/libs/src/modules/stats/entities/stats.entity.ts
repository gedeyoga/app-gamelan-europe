export type StatsCountrySummary = {
  story: number;
  event: number;
  organization: number;
  member: number;
  total: number;
};

export type StatsSummary = {
  events: {
    published: number;
    latestPublishedAt: Date | null;
  };
  users: {
    active: number;
  };
  countries: StatsCountrySummary;
};

/** Data mentah dari repository: tanpa mapping id/union. */
export type StatsCountryRef = {
  id: number;
  iso2: string;
  name: string;
};

export type StatsCountrySource = {
  countries: StatsCountryRef[];
  /** ISO-2 code dari author/creator Post PUBLISHED. */
  postCountryCodes: string[];
  /** ISO-2 code dari author/creator Event PUBLISHED. */
  eventCountryCodes: string[];
  /** ISO-2 code countryId dari SEMUA User (non-null). */
  memberCountryCodes: string[];
  /** Nama negara bebas (free text) dari Network. */
  networkCountryNames: string[];
};
